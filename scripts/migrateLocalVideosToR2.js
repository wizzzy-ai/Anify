#!/usr/bin/env node

/**
 * Anify Local Video to R2 Migration Script
 * Migrates local video files to Cloudflare R2 storage
 * 
 * Features:
 * - Scans MongoDB for local video references (Anime, Movies, Episodes, Trailers)
 * - Uploads videos to R2 using existing uploadToR2.js service
 * - Preserves existing folder structure
 * - Updates MongoDB with new URLs and metadata
 * - Skips already migrated files (storageProvider = "r2")
 * - Skips missing files without crashing
 * - Progress tracking with detailed output
 * - Resume capability via state file
 * - Detailed logging and error handling
 * - Safe to run multiple times without duplicating uploads
 * - Does NOT delete local files
 */

import dotenv from 'dotenv';
dotenv.config();

import dns from 'node:dns';

// Force Node.js to use Cloudflare DNS (same as server.js)
dns.setServers(['1.1.1.1', '1.0.0.1']);

import mongoose from 'mongoose';
import { uploadToR2, generateVideoPath } from '../utils/uploadToR2.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds
  
  // Batch size for processing
  BATCH_SIZE: 50,
  
  // Local uploads directory
  UPLOADS_DIR: path.join(__dirname, '..', 'uploads'),
  
  // State file for resume capability
  STATE_FILE: path.join(__dirname, 'migration-state.json'),
  
  // Log file
  LOG_FILE: path.join(__dirname, 'migration-log.json'),
};

// Migration state
let migrationState = {
  startTime: null,
  lastProcessedId: null,
  lastProcessedType: null, // 'anime', 'episode', 'movie', 'trailer', 'bannerVideo'
  processed: 0,
  skipped: 0,
  failed: 0,
  errors: [],
  totalItems: 0,
  currentItem: 0,
};

// MongoDB Schemas (matching server.js)
const videoMetadataSchema = new mongoose.Schema({
  storageProvider: { type: String, enum: ['r2', 'cloudinary'], default: 'r2' },
  storageKey: String,
  publicId: String,
  fileSize: Number,
  duration: Number,
  resolution: String,
  mimeType: String,
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const episodeSourceSchema = new mongoose.Schema({
  qualities: { type: Map, of: String, default: {} },
}, { _id: false });

const episodeSchema = new mongoose.Schema({
  episodeNumber: { type: Number, required: true, index: true },
  episodeTitle: { type: String, default: '' },
  thumbnail: { type: String, default: '' },
  introStart: { type: Number, default: 0 },
  introEnd: { type: Number, default: 90 },
  outroStart: { type: Number, default: 0 },
  outroEnd: { type: Number, default: 0 },
  sub: { type: episodeSourceSchema, default: () => ({ qualities: {} }) },
  dub: { type: episodeSourceSchema, default: () => ({ qualities: {} }) },
}, { timestamps: true, _id: false });

const animeSchema = new mongoose.Schema({
  clientId: { type: Number, index: true },
  type: { type: String, enum: ['anime', 'animated-movie', 'live-movie'], default: 'anime', index: true },
  title: { type: String, required: true },
  trailer: String,
  trailerMetadata: { type: videoMetadataSchema, default: null },
  bannerVideo: String,
  bannerVideoMetadata: { type: videoMetadataSchema, default: null },
  episodesMedia: { type: [episodeSchema], default: [] },
  movieMedia: {
    qualities: { type: Map, of: String, default: {} },
    metadata: { type: videoMetadataSchema, default: null },
  },
}, { timestamps: true });

// Initialize models
const Anime = mongoose.models.Anime || mongoose.model('Anime', animeSchema);

// Logging utilities
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message };
  
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  
  migrationState.errors.push(logEntry);
  
  // Write to log file
  try {
    const logs = fs.existsSync(CONFIG.LOG_FILE) 
      ? JSON.parse(fs.readFileSync(CONFIG.LOG_FILE, 'utf-8'))
      : [];
    logs.push(logEntry);
    fs.writeFileSync(CONFIG.LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Failed to write to log file:', error.message);
  }
}

function saveState() {
  try {
    fs.writeFileSync(CONFIG.STATE_FILE, JSON.stringify(migrationState, null, 2));
  } catch (error) {
    console.error('Failed to save state:', error.message);
  }
}

function loadState() {
  try {
    if (fs.existsSync(CONFIG.STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(CONFIG.STATE_FILE, 'utf-8'));
      return state;
    }
  } catch (error) {
    console.error('Failed to load state:', error.message);
  }
  return null;
}

// File utilities
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch (error) {
    return 0;
  }
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/mkv',
    '.mov': 'video/quicktime',
  };
  return mimeTypes[ext] || 'video/mp4';
}

function isLocalPath(url) {
  if (!url) return false;
  return url.startsWith('/uploads/') || url.startsWith('uploads/') || !url.startsWith('http');
}

function getLocalFilePath(url) {
  if (!url) return null;
  
  // Handle various path formats
  if (url.startsWith('/uploads/')) {
    return path.join(__dirname, '..', url);
  }
  if (url.startsWith('uploads/')) {
    return path.join(__dirname, '..', url);
  }
  if (!url.startsWith('http')) {
    return path.join(__dirname, '..', 'uploads', url);
  }
  
  return null;
}

// Upload utilities
async function uploadWithRetry(file, folder, retries = CONFIG.MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await uploadToR2(file, folder);
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      log(`Upload failed (attempt ${attempt}/${retries}), retrying in ${CONFIG.RETRY_DELAY}ms...`, 'warn');
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
    }
  }
}

// Migration functions
async function migrateVideoFile(filePath, folder, context) {
  if (!fileExists(filePath)) {
    log(`Video file not found: ${filePath}`, 'warn');
    return null;
  }

  const fileName = path.basename(filePath);
  const fileSize = getFileSize(filePath);
  const mimeType = getMimeType(filePath);

  log(`Uploading video: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`, 'info');

  try {
    // Read file into buffer
    const buffer = fs.readFileSync(filePath);
    
    // Create file object matching uploadToR2 expectations
    const file = {
      buffer: buffer,
      originalname: fileName,
      size: fileSize,
      mimetype: mimeType,
    };

    // Upload to R2
    const result = await uploadWithRetry(file, folder);
    
    log(`✓ Uploaded: ${fileName}`, 'info');
    
    return {
      url: result.url,
      key: result.key,
      storageProvider: 'r2',
      fileSize: fileSize,
      mimeType: mimeType,
      uploadedAt: new Date(),
    };
  } catch (error) {
    log(`Failed to upload video ${fileName}: ${error.message}`, 'error');
    throw error;
  }
}

async function migrateTrailer(anime) {
  const animeId = String(anime._id);
  
  if (!anime.trailer || !isLocalPath(anime.trailer)) {
    return null;
  }

  // Skip if already migrated
  if (anime.trailerMetadata && anime.trailerMetadata.storageProvider === 'r2') {
    log(`Trailer already migrated: ${anime.title}`, 'info');
    migrationState.skipped++;
    return null;
  }

  const localPath = getLocalFilePath(anime.trailer);
  if (!localPath || !fileExists(localPath)) {
    log(`Trailer file not found: ${anime.trailer}`, 'warn');
    migrationState.skipped++;
    return null;
  }

  migrationState.currentItem++;
  console.log(`[${migrationState.currentItem}/${migrationState.totalItems}] Uploading Trailer for ${anime.title}...`);

  try {
    const folder = `videos/trailers/${animeId}`;
    const metadata = await migrateVideoFile(localPath, folder, `trailer/${animeId}`);
    
    if (metadata) {
      await Anime.findByIdAndUpdate(animeId, {
        trailer: metadata.url,
        trailerMetadata: metadata,
      });
      console.log('✓ MongoDB updated');
      migrationState.processed++;
    }
    
    migrationState.lastProcessedId = animeId;
    migrationState.lastProcessedType = 'trailer';
    saveState();
    
    return metadata;
  } catch (error) {
    console.log('✗ Upload failed');
    migrationState.failed++;
    migrationState.lastProcessedId = animeId;
    migrationState.lastProcessedType = 'trailer';
    saveState();
    return null;
  }
}

async function migrateBannerVideo(anime) {
  const animeId = String(anime._id);
  
  if (!anime.bannerVideo || !isLocalPath(anime.bannerVideo)) {
    return null;
  }

  // Skip if already migrated
  if (anime.bannerVideoMetadata && anime.bannerVideoMetadata.storageProvider === 'r2') {
    log(`Banner video already migrated: ${anime.title}`, 'info');
    migrationState.skipped++;
    return null;
  }

  const localPath = getLocalFilePath(anime.bannerVideo);
  if (!localPath || !fileExists(localPath)) {
    log(`Banner video file not found: ${anime.bannerVideo}`, 'warn');
    migrationState.skipped++;
    return null;
  }

  migrationState.currentItem++;
  console.log(`[${migrationState.currentItem}/${migrationState.totalItems}] Uploading Banner Video for ${anime.title}...`);

  try {
    const folder = `videos/banners/${animeId}`;
    const metadata = await migrateVideoFile(localPath, folder, `banner/${animeId}`);
    
    if (metadata) {
      await Anime.findByIdAndUpdate(animeId, {
        bannerVideo: metadata.url,
        bannerVideoMetadata: metadata,
      });
      console.log('✓ MongoDB updated');
      migrationState.processed++;
    }
    
    migrationState.lastProcessedId = animeId;
    migrationState.lastProcessedType = 'bannerVideo';
    saveState();
    
    return metadata;
  } catch (error) {
    console.log('✗ Upload failed');
    migrationState.failed++;
    migrationState.lastProcessedId = animeId;
    migrationState.lastProcessedType = 'bannerVideo';
    saveState();
    return null;
  }
}

async function migrateEpisode(anime, episode, episodeIndex) {
  const animeId = String(anime._id);
  const episodeNumber = episode.episodeNumber;
  
  // Process both sub and dub qualities
  const allQualities = [];
  
  // Sub qualities
  if (episode.sub && episode.sub.qualities) {
    const subQualities = episode.sub.qualities instanceof Map 
      ? Object.fromEntries(episode.sub.qualities) 
      : episode.sub.qualities;
    
    Object.entries(subQualities).forEach(([quality, url]) => {
      allQualities.push({ quality, url, language: 'sub' });
    });
  }
  
  // Dub qualities
  if (episode.dub && episode.dub.qualities) {
    const dubQualities = episode.dub.qualities instanceof Map 
      ? Object.fromEntries(episode.dub.qualities) 
      : episode.dub.qualities;
    
    Object.entries(dubQualities).forEach(([quality, url]) => {
      allQualities.push({ quality, url, language: 'dub' });
    });
  }
  
  if (allQualities.length === 0) {
    return null;
  }
  
  let updatedEpisode = { ...episode };
  let hasChanges = false;
  
  for (const { quality, url, language } of allQualities) {
    if (!url || !isLocalPath(url)) {
      continue;
    }
    
    // Skip if already has R2 metadata (check if URL is already an R2 URL)
    if (url.includes(process.env.R2_PUBLIC_URL) || url.includes('r2.dev')) {
      log(`Episode ${episodeNumber} ${quality} ${language} already on R2`, 'info');
      migrationState.skipped++;
      continue;
    }
    
    const localPath = getLocalFilePath(url);
    if (!localPath || !fileExists(localPath)) {
      log(`Episode ${episodeNumber} ${quality} ${language} file not found: ${url}`, 'warn');
      migrationState.skipped++;
      continue;
    }
    
    migrationState.currentItem++;
    console.log(`[${migrationState.currentItem}/${migrationState.totalItems}] Uploading Episode ${episodeNumber} (${quality} ${language}) for ${anime.title}...`);
    
    try {
      const folder = `videos/anime/${animeId}/season-1`;
      const metadata = await migrateVideoFile(localPath, folder, `episode/${animeId}/${episodeNumber}`);
      
      if (metadata) {
        // Update the quality URL in the appropriate language map
        if (language === 'sub') {
          const subQualities = updatedEpisode.sub.qualities instanceof Map 
            ? Object.fromEntries(updatedEpisode.sub.qualities) 
            : updatedEpisode.sub.qualities;
          subQualities[quality] = metadata.url;
          updatedEpisode.sub = { ...updatedEpisode.sub, qualities: subQualities };
        } else {
          const dubQualities = updatedEpisode.dub.qualities instanceof Map 
            ? Object.fromEntries(updatedEpisode.dub.qualities) 
            : updatedEpisode.dub.qualities;
          dubQualities[quality] = metadata.url;
          updatedEpisode.dub = { ...updatedEpisode.dub, qualities: dubQualities };
        }
        
        hasChanges = true;
        console.log('✓ MongoDB updated');
        migrationState.processed++;
      }
      
      migrationState.lastProcessedId = animeId;
      migrationState.lastProcessedType = `episode_${episodeIndex}_${quality}_${language}`;
      saveState();
      
    } catch (error) {
      console.log('✗ Upload failed');
      migrationState.failed++;
      migrationState.lastProcessedId = animeId;
      migrationState.lastProcessedType = `episode_${episodeIndex}_${quality}_${language}`;
      saveState();
    }
  }
  
  if (hasChanges) {
    // Update the episode in the array
    const episodesMedia = [...anime.episodesMedia];
    episodesMedia[episodeIndex] = updatedEpisode;
    
    await Anime.findByIdAndUpdate(animeId, {
      episodesMedia: episodesMedia,
    });
  }
  
  return hasChanges ? updatedEpisode : null;
}

async function migrateMovieMedia(anime) {
  const animeId = String(anime._id);
  
  if (!anime.movieMedia || !anime.movieMedia.qualities) {
    return null;
  }
  
  // Skip if already migrated
  if (anime.movieMedia.metadata && anime.movieMedia.metadata.storageProvider === 'r2') {
    log(`Movie media already migrated: ${anime.title}`, 'info');
    migrationState.skipped++;
    return null;
  }
  
  const qualities = anime.movieMedia.qualities instanceof Map 
    ? Object.fromEntries(anime.movieMedia.qualities) 
    : anime.movieMedia.qualities;
  
  let updatedQualities = { ...qualities };
  let hasChanges = false;
  
  for (const [quality, url] of Object.entries(qualities)) {
    if (!url || !isLocalPath(url)) {
      continue;
    }
    
    // Skip if already an R2 URL
    if (url.includes(process.env.R2_PUBLIC_URL) || url.includes('r2.dev')) {
      log(`Movie ${quality} already on R2`, 'info');
      migrationState.skipped++;
      continue;
    }
    
    const localPath = getLocalFilePath(url);
    if (!localPath || !fileExists(localPath)) {
      log(`Movie ${quality} file not found: ${url}`, 'warn');
      migrationState.skipped++;
      continue;
    }
    
    migrationState.currentItem++;
    console.log(`[${migrationState.currentItem}/${migrationState.totalItems}] Uploading Movie (${quality}) for ${anime.title}...`);
    
    try {
      const folder = `videos/movies/${animeId}`;
      const metadata = await migrateVideoFile(localPath, folder, `movie/${animeId}`);
      
      if (metadata) {
        updatedQualities[quality] = metadata.url;
        hasChanges = true;
        console.log('✓ MongoDB updated');
        migrationState.processed++;
      }
      
      migrationState.lastProcessedId = animeId;
      migrationState.lastProcessedType = `movie_${quality}`;
      saveState();
      
    } catch (error) {
      console.log('✗ Upload failed');
      migrationState.failed++;
      migrationState.lastProcessedId = animeId;
      migrationState.lastProcessedType = `movie_${quality}`;
      saveState();
    }
  }
  
  if (hasChanges) {
    await Anime.findByIdAndUpdate(animeId, {
      'movieMedia.qualities': updatedQualities,
      'movieMedia.metadata': {
        storageProvider: 'r2',
        uploadedAt: new Date(),
      },
    });
  }
  
  return hasChanges ? updatedQualities : null;
}

async function migrateAnime(anime) {
  const animeId = String(anime._id);
  log(`Processing anime: ${anime.title} (${animeId})`, 'info');

  // Migrate trailer
  await migrateTrailer(anime);
  
  // Migrate banner video
  await migrateBannerVideo(anime);
  
  // Migrate episodes
  if (anime.episodesMedia && anime.episodesMedia.length > 0) {
    for (let i = 0; i < anime.episodesMedia.length; i++) {
      await migrateEpisode(anime, anime.episodesMedia[i], i);
    }
  }
  
  // Migrate movie media
  await migrateMovieMedia(anime);
}

// Count total items to migrate
async function countTotalItems() {
  const animes = await Anime.find().lean();
  let total = 0;
  
  for (const anime of animes) {
    // Count trailer
    if (anime.trailer && isLocalPath(anime.trailer) && 
        !(anime.trailerMetadata && anime.trailerMetadata.storageProvider === 'r2')) {
      total++;
    }
    
    // Count banner video
    if (anime.bannerVideo && isLocalPath(anime.bannerVideo) && 
        !(anime.bannerVideoMetadata && anime.bannerVideoMetadata.storageProvider === 'r2')) {
      total++;
    }
    
    // Count episode qualities
    if (anime.episodesMedia && anime.episodesMedia.length > 0) {
      for (const episode of anime.episodesMedia) {
        const subQualities = episode.sub?.qualities instanceof Map 
          ? Object.fromEntries(episode.sub.qualities) 
          : episode.sub?.qualities || {};
        const dubQualities = episode.dub?.qualities instanceof Map 
          ? Object.fromEntries(episode.dub.qualities) 
          : episode.dub?.qualities || {};
        
        for (const [quality, url] of Object.entries(subQualities)) {
          if (url && isLocalPath(url) && !url.includes(process.env.R2_PUBLIC_URL) && !url.includes('r2.dev')) {
            total++;
          }
        }
        for (const [quality, url] of Object.entries(dubQualities)) {
          if (url && isLocalPath(url) && !url.includes(process.env.R2_PUBLIC_URL) && !url.includes('r2.dev')) {
            total++;
          }
        }
      }
    }
    
    // Count movie qualities
    if (anime.movieMedia?.qualities) {
      const qualities = anime.movieMedia.qualities instanceof Map 
        ? Object.fromEntries(anime.movieMedia.qualities) 
        : anime.movieMedia.qualities;
      
      for (const [quality, url] of Object.entries(qualities)) {
        if (url && isLocalPath(url) && !url.includes(process.env.R2_PUBLIC_URL) && !url.includes('r2.dev') &&
            !(anime.movieMedia.metadata && anime.movieMedia.metadata.storageProvider === 'r2')) {
          total++;
        }
      }
    }
  }
  
  return total;
}

// Main migration logic
async function runMigration() {
  log('Starting Anify local video to R2 migration...', 'info');
  migrationState.startTime = new Date();

  // Load previous state if exists
  const previousState = loadState();
  if (previousState) {
    log(`Resuming from previous state...`, 'info');
    migrationState = { ...migrationState, ...previousState };
  }

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    log('Connected to MongoDB', 'info');

    // Count total items if not already counted
    if (migrationState.totalItems === 0) {
      migrationState.totalItems = await countTotalItems();
      log(`Found ${migrationState.totalItems} video files to migrate`, 'info');
      saveState();
    } else {
      log(`Resuming with ${migrationState.totalItems} total items`, 'info');
    }

    // Get all anime
    const animeCursor = Anime.find().sort({ _id: 1 }).cursor();
    let animeCount = 0;

    for await (const anime of animeCursor) {
      const animeId = String(anime._id);
      
      // Skip if we've already processed this anime (resume capability)
      if (migrationState.lastProcessedId && animeId <= migrationState.lastProcessedId) {
        animeCount++;
        continue;
      }
      
      await migrateAnime(anime);
      animeCount++;
      
      if (animeCount % CONFIG.BATCH_SIZE === 0) {
        log(`Progress: ${animeCount} anime processed`, 'info');
      }
    }

    log(`Completed migration: ${animeCount} anime processed`, 'info');

    // Generate summary
    const duration = Date.now() - migrationState.startTime;
    const summary = {
      duration: `${(duration / 1000).toFixed(2)}s`,
      processed: migrationState.processed,
      skipped: migrationState.skipped,
      failed: migrationState.failed,
      total: migrationState.processed + migrationState.skipped + migrationState.failed,
      animeProcessed: animeCount,
      errors: migrationState.errors.filter(e => e.level === 'error').length,
    };

    console.log('\n========================================');
    console.log('Migration complete');
    console.log('========================================');
    console.log(`Uploaded: ${summary.processed}`);
    console.log(`Skipped: ${summary.skipped}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Total: ${summary.total}`);
    console.log(`Duration: ${summary.duration}`);
    console.log(`Anime processed: ${summary.animeProcessed}`);
    console.log('========================================\n');

    log('\n=== MIGRATION SUMMARY ===', 'info');
    log(`Duration: ${summary.duration}`, 'info');
    log(`Uploaded: ${summary.processed}`, 'info');
    log(`Skipped: ${summary.skipped}`, 'info');
    log(`Failed: ${summary.failed}`, 'info');
    log(`Total: ${summary.total}`, 'info');
    log(`Anime: ${summary.animeProcessed}`, 'info');
    log(`Errors: ${summary.errors}`, 'info');
    log('========================\n', 'info');

    // Save summary
    fs.writeFileSync(
      path.join(__dirname, 'migration-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    // Clean up state file on success
    if (migrationState.failed === 0) {
      fs.unlinkSync(CONFIG.STATE_FILE);
      log('Migration completed successfully. State file cleaned up.', 'info');
    } else {
      log('Migration completed with errors. State file preserved for resume.', 'warn');
    }

  } catch (error) {
    log(`Migration failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log('Disconnected from MongoDB', 'info');
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
