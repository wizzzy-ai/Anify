#!/usr/bin/env node

/**
 * Anify Image Migration to Cloudinary
 * Migrates local image files to Cloudinary storage
 * 
 * Features:
 * - Scans MongoDB for local image references
 * - Uploads images to Cloudinary using imageStorage service
 * - Preserves existing folder structure
 * - Updates MongoDB with new URLs and metadata
 * - Skips already migrated images (storageProvider = "cloudinary")
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
import { uploadImage } from '../imageStorage.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../../User.js';
import Anime from '../../models/Anime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  BATCH_SIZE: 50,
  UPLOADS_DIR: path.join(__dirname, '..', '..', 'uploads'),
  STATE_FILE: path.join(__dirname, 'images-migration-state.json'),
  LOG_FILE: path.join(__dirname, 'images-migration-log.json'),
};

// Migration state
let migrationState = {
  startTime: null,
  lastProcessedId: null,
  lastProcessedType: null,
  processed: 0,
  skipped: 0,
  failed: 0,
  errors: [],
  totalItems: 0,
  currentItem: 0,
};

// Logging utilities
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message };
  
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  
  migrationState.errors.push(logEntry);
  
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
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

function isLocalPath(url) {
  if (!url) return false;
  return url.startsWith('/uploads/') || url.startsWith('uploads/') || !url.startsWith('http');
}

function getLocalFilePath(url) {
  if (!url) return null;
  
  if (url.startsWith('/uploads/')) {
    return path.join(__dirname, '..', '..', url);
  }
  if (url.startsWith('uploads/')) {
    return path.join(__dirname, '..', '..', url);
  }
  if (!url.startsWith('http')) {
    return path.join(__dirname, '..', '..', 'uploads', url);
  }
  
  return null;
}

// Upload utilities
async function uploadWithRetry(file, folder, imageType, id, retries = CONFIG.MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await uploadImage(file, { imageType, id, folder });
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
async function migrateImageFile(filePath, folder, imageType, id, context) {
  if (!fileExists(filePath)) {
    log(`Image file not found: ${filePath}`, 'warn');
    return null;
  }

  const fileName = path.basename(filePath);
  const fileSize = getFileSize(filePath);
  const mimeType = getMimeType(filePath);

  log(`Uploading image: ${fileName} (${(fileSize / 1024).toFixed(2)} KB)`, 'info');

  try {
    const buffer = fs.readFileSync(filePath);
    
    const file = {
      buffer: buffer,
      originalname: fileName,
      size: fileSize,
      mimetype: mimeType,
    };

    const result = await uploadWithRetry(file, folder, imageType, id);
    
    log(`✓ Uploaded: ${fileName}`, 'info');
    
    return {
      url: result.url,
      publicId: result.publicId,
      storageProvider: 'cloudinary',
      width: result.metadata?.width,
      height: result.metadata?.height,
      format: result.metadata?.format,
      bytes: fileSize,
      uploadedAt: new Date(),
    };
  } catch (error) {
    log(`Failed to upload image ${fileName}: ${error.message}`, 'error');
    throw error;
  }
}

async function migrateAnimePoster(anime) {
  const animeId = String(anime._id);
  
  if (!anime.image || !isLocalPath(anime.image)) {
    return null;
  }

  if (anime.imageMetadata && anime.imageMetadata.storageProvider === 'cloudinary') {
    log(`Poster already migrated: ${anime.title}`, 'info');
    migrationState.skipped++;
    return null;
  }

  const localPath = getLocalFilePath(anime.image);
  if (!localPath || !fileExists(localPath)) {
    log(`Poster file not found: ${anime.image}`, 'warn');
    migrationState.skipped++;
    return null;
  }

  migrationState.currentItem++;
  console.log(`[${migrationState.currentItem}/${migrationState.totalItems}] 🖼️  Uploading Poster for ${anime.title}...`);

  try {
    const metadata = await migrateImageFile(localPath, null, 'poster', animeId, `poster/${animeId}`);
    
    if (metadata) {
      await Anime.findByIdAndUpdate(animeId, {
        image: metadata.url,
        imageMetadata: metadata,
      });
      console.log('   ✅ MongoDB updated');
      migrationState.processed++;
    }
    
    migrationState.lastProcessedId = animeId;
    migrationState.lastProcessedType = 'poster';
    saveState();
    
    return metadata;
  } catch (error) {
    console.log('   ❌ Upload failed');
    migrationState.failed++;
    migrationState.lastProcessedId = animeId;
    migrationState.lastProcessedType = 'poster';
    saveState();
    return null;
  }
}

async function migrateAnimeBanner(anime) {
  const animeId = String(anime._id);
  
  if (!anime.banner || !isLocalPath(anime.banner)) {
    return null;
  }

  if (anime.bannerMetadata && anime.bannerMetadata.storageProvider === 'cloudinary') {
    log(`Banner already migrated: ${anime.title}`, 'info');
    migrationState.skipped++;
    return null;
  }

  const localPath = getLocalFilePath(anime.banner);
  if (!localPath || !fileExists(localPath)) {
    log(`Banner file not found: ${anime.banner}`, 'warn');
    migrationState.skipped++;
    return null;
  }

  migrationState.currentItem++;
  console.log(`[${migrationState.currentItem}/${migrationState.totalItems}] 🎨 Uploading Banner for ${anime.title}...`);

  try {
    const metadata = await migrateImageFile(localPath, null, 'banner', animeId, `banner/${animeId}`);
    
    if (metadata) {
      await Anime.findByIdAndUpdate(animeId, {
        banner: metadata.url,
        bannerMetadata: metadata,
      });
      console.log('   ✅ MongoDB updated');
      migrationState.processed++;
    }
    
    migrationState.lastProcessedId = animeId;
    migrationState.lastProcessedType = 'banner';
    saveState();
    
    return metadata;
  } catch (error) {
    console.log('   ❌ Upload failed');
    migrationState.failed++;
    migrationState.lastProcessedId = animeId;
    migrationState.lastProcessedType = 'banner';
    saveState();
    return null;
  }
}

async function migrateEpisodeThumbnail(anime, episode, episodeIndex) {
  const animeId = String(anime._id);
  const episodeNumber = episode.episodeNumber;
  
  if (!episode.thumbnail || !isLocalPath(episode.thumbnail)) {
    return null;
  }

  if (episode.thumbnailMetadata && episode.thumbnailMetadata.storageProvider === 'cloudinary') {
    log(`Episode ${episodeNumber} thumbnail already migrated`, 'info');
    migrationState.skipped++;
    return null;
  }

  const localPath = getLocalFilePath(episode.thumbnail);
  if (!localPath || !fileExists(localPath)) {
    log(`Episode ${episodeNumber} thumbnail file not found: ${episode.thumbnail}`, 'warn');
    migrationState.skipped++;
    return null;
  }

  migrationState.currentItem++;
  console.log(`[${migrationState.currentItem}/${migrationState.totalItems}] 📸 Uploading Thumbnail for Episode ${episodeNumber} of ${anime.title}...`);

  try {
    const metadata = await migrateImageFile(localPath, null, 'thumbnail', animeId, `thumbnail/${animeId}/${episodeNumber}`);
    
    if (metadata) {
      const episodesMedia = [...anime.episodesMedia];
      episodesMedia[episodeIndex] = {
        ...episode,
        thumbnail: metadata.url,
        thumbnailMetadata: metadata,
      };
      
      await Anime.findByIdAndUpdate(animeId, {
        episodesMedia: episodesMedia,
      });
      console.log('   ✅ MongoDB updated');
      migrationState.processed++;
    }
    
    migrationState.lastProcessedId = animeId;
    migrationState.lastProcessedType = `episode_thumbnail_${episodeIndex}`;
    saveState();
    
    return metadata;
  } catch (error) {
    console.log('   ❌ Upload failed');
    migrationState.failed++;
    migrationState.lastProcessedId = animeId;
    migrationState.lastProcessedType = `episode_thumbnail_${episodeIndex}`;
    saveState();
    return null;
  }
}

async function migrateUserAvatar(user) {
  const userId = String(user._id);
  
  if (!user.avatar || !isLocalPath(user.avatar)) {
    return null;
  }

  if (user.avatarMetadata && user.avatarMetadata.storageProvider === 'cloudinary') {
    log(`Avatar already migrated: ${user.username}`, 'info');
    migrationState.skipped++;
    return null;
  }

  const localPath = getLocalFilePath(user.avatar);
  if (!localPath || !fileExists(localPath)) {
    log(`Avatar file not found: ${user.avatar}`, 'warn');
    migrationState.skipped++;
    return null;
  }

  migrationState.currentItem++;
  console.log(`[${migrationState.currentItem}/${migrationState.totalItems}] 👤 Uploading Avatar for ${user.username}...`);

  try {
    const metadata = await migrateImageFile(localPath, null, 'avatar', userId, `avatar/${userId}`);
    
    if (metadata) {
      await User.findByIdAndUpdate(userId, {
        avatar: metadata.url,
        avatarMetadata: metadata,
      });
      console.log('   ✅ MongoDB updated');
      migrationState.processed++;
    }
    
    migrationState.lastProcessedId = userId;
    migrationState.lastProcessedType = 'avatar';
    saveState();
    
    return metadata;
  } catch (error) {
    console.log('   ❌ Upload failed');
    migrationState.failed++;
    migrationState.lastProcessedId = userId;
    migrationState.lastProcessedType = 'avatar';
    saveState();
    return null;
  }
}

async function migrateAnime(anime) {
  const animeId = String(anime._id);
  log(`Processing anime: ${anime.title} (${animeId})`, 'info');

  await migrateAnimePoster(anime);
  await migrateAnimeBanner(anime);
  
  if (anime.episodesMedia && anime.episodesMedia.length > 0) {
    for (let i = 0; i < anime.episodesMedia.length; i++) {
      await migrateEpisodeThumbnail(anime, anime.episodesMedia[i], i);
    }
  }
}

async function countTotalItems() {
  const animes = await Anime.find().lean();
  const users = await User.find().lean();
  let total = 0;
  
  for (const anime of animes) {
    if (anime.image && isLocalPath(anime.image) && 
        !(anime.imageMetadata && anime.imageMetadata.storageProvider === 'cloudinary')) {
      total++;
    }
    
    if (anime.banner && isLocalPath(anime.banner) && 
        !(anime.bannerMetadata && anime.bannerMetadata.storageProvider === 'cloudinary')) {
      total++;
    }
    
    if (anime.episodesMedia && anime.episodesMedia.length > 0) {
      for (const episode of anime.episodesMedia) {
        if (episode.thumbnail && isLocalPath(episode.thumbnail) &&
            !(episode.thumbnailMetadata && episode.thumbnailMetadata.storageProvider === 'cloudinary')) {
          total++;
        }
      }
    }
  }
  
  for (const user of users) {
    if (user.avatar && isLocalPath(user.avatar) &&
        !(user.avatarMetadata && user.avatarMetadata.storageProvider === 'cloudinary')) {
      total++;
    }
  }
  
  return total;
}

async function runMigration() {
  console.log('\n🚀 ========================================');
  console.log('🚀  Anify Image Migration to Cloudinary');
  console.log('🚀 ========================================\n');
  log('Starting Anify image migration to Cloudinary...', 'info');
  migrationState.startTime = new Date();

  const previousState = loadState();
  if (previousState) {
    console.log('🔄 Resuming from previous state...\n');
    log(`Resuming from previous state...`, 'info');
    migrationState = { ...migrationState, ...previousState };
  }

  try {
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    log('Connected to MongoDB', 'info');

    if (migrationState.totalItems === 0) {
      migrationState.totalItems = await countTotalItems();
      console.log(`📊 Found ${migrationState.totalItems} image files to migrate\n`);
      log(`Found ${migrationState.totalItems} image files to migrate`, 'info');
      saveState();
    } else {
      console.log(`📊 Resuming with ${migrationState.totalItems} total items\n`);
      log(`Resuming with ${migrationState.totalItems} total items`, 'info');
    }

    // Migrate anime images
    const animeCursor = Anime.find().sort({ _id: 1 }).cursor();
    let animeCount = 0;

    for await (const anime of animeCursor) {
      const animeId = String(anime._id);
      
      if (migrationState.lastProcessedId && animeId <= migrationState.lastProcessedId && migrationState.lastProcessedType !== 'avatar') {
        animeCount++;
        continue;
      }
      
      await migrateAnime(anime);
      animeCount++;
      
      if (animeCount % CONFIG.BATCH_SIZE === 0) {
        console.log(`📈 Progress: ${animeCount} anime processed`);
        log(`Progress: ${animeCount} anime processed`, 'info');
      }
    }

    log(`Completed anime image migration: ${animeCount} anime processed`, 'info');

    // Migrate user avatars
    const userCursor = User.find().sort({ _id: 1 }).cursor();
    let userCount = 0;

    for await (const user of userCursor) {
      const userId = String(user._id);
      
      if (migrationState.lastProcessedId && userId <= migrationState.lastProcessedId && migrationState.lastProcessedType === 'avatar') {
        userCount++;
        continue;
      }
      
      await migrateUserAvatar(user);
      userCount++;
      
      if (userCount % CONFIG.BATCH_SIZE === 0) {
        console.log(`📈 Progress: ${userCount} users processed`);
        log(`Progress: ${userCount} users processed`, 'info');
      }
    }

    log(`Completed user avatar migration: ${userCount} users processed`, 'info');

    const duration = Date.now() - migrationState.startTime;
    const summary = {
      duration: `${(duration / 1000).toFixed(2)}s`,
      processed: migrationState.processed,
      skipped: migrationState.skipped,
      failed: migrationState.failed,
      total: migrationState.processed + migrationState.skipped + migrationState.failed,
      animeProcessed: animeCount,
      usersProcessed: userCount,
      errors: migrationState.errors.filter(e => e.level === 'error').length,
    };

    console.log('\n🎉 ========================================');
    console.log('🎉  Migration Complete!');
    console.log('🎉 ========================================\n');
    console.log(`✅ Uploaded: ${summary.processed}`);
    console.log(`⏭️  Skipped: ${summary.skipped}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`📊 Total: ${summary.total}`);
    console.log(`⏱️  Duration: ${summary.duration}`);
    console.log(`🎬 Anime processed: ${summary.animeProcessed}`);
    console.log(`👥 Users processed: ${summary.usersProcessed}`);
    console.log('\n🎉 ========================================\n');

    log('\n=== MIGRATION SUMMARY ===', 'info');
    log(`Duration: ${summary.duration}`, 'info');
    log(`Uploaded: ${summary.processed}`, 'info');
    log(`Skipped: ${summary.skipped}`, 'info');
    log(`Failed: ${summary.failed}`, 'info');
    log(`Total: ${summary.total}`, 'info');
    log(`Anime: ${summary.animeProcessed}`, 'info');
    log(`Users: ${summary.usersProcessed}`, 'info');
    log(`Errors: ${summary.errors}`, 'info');
    log('========================\n', 'info');

    fs.writeFileSync(
      path.join(__dirname, 'images-migration-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    if (migrationState.failed === 0) {
      fs.unlinkSync(CONFIG.STATE_FILE);
      log('Migration completed successfully. State file cleaned up.', 'info');
    } else {
      log('Migration completed with errors. State file preserved for resume.', 'warn');
    }

  } catch (error) {
    console.log('\n❌ ========================================');
    console.log('❌  Migration Failed!');
    console.log('❌ ========================================\n');
    console.log(`❌ Error: ${error.message}`);
    log(`Migration failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB\n');
    log('Disconnected from MongoDB', 'info');
  }
}

runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
