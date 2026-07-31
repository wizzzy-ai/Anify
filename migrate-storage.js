#!/usr/bin/env node

/**
 * Anify Storage Migration Tool
 * Migrates local media files to Cloudflare R2 (videos) and Cloudinary (images)
 * 
 * Features:
 * - Scans MongoDB for media files
 * - Uploads videos to R2
 * - Uploads images to Cloudinary
 * - Updates MongoDB with new URLs and metadata
 * - Skips already migrated files
 * - Progress tracking
 * - Retry failed uploads
 * - Resume capability
 * - Migration logging
 * - Summary report
 */

import dns from 'node:dns';
// Force Node.js to use a reliable public DNS resolver
dns.setServers(["1.1.1.1", "1.0.0.1"]);

import mongoose from 'mongoose';
import { uploadToR2 } from './utils/uploadToR2.js';
import { uploadToCloudinary } from './utils/cloudinaryUpload.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
    // Retry configuration
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000, // 2 seconds
    
    // Batch size for processing
    BATCH_SIZE: 50,
    
    // Progress update interval
    PROGRESS_INTERVAL: 1000, // 1 second
    
    // Log file
    LOG_FILE: path.join(__dirname, 'migration-log.json'),
    STATE_FILE: path.join(__dirname, 'migration-state.json'),
    
    // Local uploads directory
    UPLOADS_DIR: path.join(__dirname, 'uploads'),
    
    // Migration thresholds
    MAX_CONCURRENT_UPLOADS: 5,
};

// Migration state
let migrationState = {
    startTime: null,
    lastProcessedId: null,
    processed: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    progress: 0,
};

// MongoDB Schemas (copied from server.js)
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

const imageMetadataSchema = new mongoose.Schema({
    storageProvider: { type: String, enum: ['cloudinary'], default: 'cloudinary' },
    publicId: String,
    width: Number,
    height: Number,
    format: String,
    bytes: Number,
    uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const movieMediaSchema = new mongoose.Schema({
    quality: String,
    url: String,
    metadata: { type: videoMetadataSchema, default: null },
});

const animeSchema = new mongoose.Schema({
    title: String,
    image: String,
    imageMetadata: { type: imageMetadataSchema, default: null },
    banner: String,
    bannerMetadata: { type: imageMetadataSchema, default: null },
    bannerVideo: String,
    bannerVideoMetadata: { type: videoMetadataSchema, default: null },
    bannerDisplay: { type: String, default: 'image' },
    desc: String,
    featured: Boolean,
    trending: Boolean,
    premium: Boolean,
    newEpisode: Boolean,
    trailer: String,
    trailerMetadata: { type: videoMetadataSchema, default: null },
    genres: [String],
    rating: Number,
    year: Number,
    status: String,
    totalEpisodes: Number,
    episodes: [movieMediaSchema],
    movies: [movieMediaSchema],
    likes: { type: Number, default: 0 },
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

function isLocalPath(url) {
    if (!url) return false;
    return url.startsWith('/uploads/') || url.startsWith('uploads/') || !url.startsWith('http');
}

function getLocalFilePath(url) {
    if (!url) return null;
    
    // Handle various path formats
    if (url.startsWith('/uploads/')) {
        return path.join(__dirname, url);
    }
    if (url.startsWith('uploads/')) {
        return path.join(__dirname, url);
    }
    if (!url.startsWith('http')) {
        return path.join(__dirname, 'uploads', url);
    }
    
    return null;
}

// Upload utilities
async function uploadWithRetry(uploadFn, filePath, retries = CONFIG.MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await uploadFn(filePath);
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
async function migrateVideo(filePath, animeId, episodeIndex = null, movieIndex = null) {
    if (!fileExists(filePath)) {
        log(`Video file not found: ${filePath}`, 'warn');
        return null;
    }

    const fileName = path.basename(filePath);
    const storageKey = `videos/${animeId}/${episodeIndex !== null ? `episodes/${episodeIndex}` : `movies/${movieIndex}`}/${fileName}`;

    log(`Uploading video: ${fileName}`, 'info');

    try {
        const result = await uploadWithRetry(uploadToR2, filePath);
        
        return {
            storageProvider: 'r2',
            storageKey: storageKey,
            fileSize: getFileSize(filePath),
            mimeType: 'video/mp4',
            uploadedAt: new Date(),
        };
    } catch (error) {
        log(`Failed to upload video ${fileName}: ${error.message}`, 'error');
        throw error;
    }
}

async function migrateImage(filePath, context) {
    if (!fileExists(filePath)) {
        log(`Image file not found: ${filePath}`, 'warn');
        return null;
    }

    const fileName = path.basename(filePath);
    const publicId = `anify/${context}/${path.parse(fileName).name}`;

    log(`Uploading image: ${fileName}`, 'info');

    try {
        const result = await uploadWithRetry(uploadToCloudinary, filePath);
        
        return {
            storageProvider: 'cloudinary',
            publicId: result.public_id || publicId,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
            uploadedAt: new Date(),
        };
    } catch (error) {
        log(`Failed to upload image ${fileName}: ${error.message}`, 'error');
        throw error;
    }
}

// Main migration logic
async function migrateAnime(anime) {
    const animeId = String(anime._id);
    log(`Processing anime: ${anime.title} (${animeId})`, 'info');

    let updates = {};
    let hasChanges = false;

    // Migrate poster/image
    if (anime.image && isLocalPath(anime.image)) {
        const localPath = getLocalFilePath(anime.image);
        
        // Skip if already migrated
        if (anime.imageMetadata && anime.imageMetadata.storageProvider === 'cloudinary') {
            log(`Image already migrated: ${anime.image}`, 'info');
            migrationState.skipped++;
        } else if (localPath && fileExists(localPath)) {
            try {
                const metadata = await migrateImage(localPath, `anime/${animeId}/poster`);
                if (metadata) {
                    updates.image = anime.image; // Keep original URL until we update with Cloudinary URL
                    updates.imageMetadata = metadata;
                    hasChanges = true;
                    migrationState.processed++;
                }
            } catch (error) {
                migrationState.failed++;
            }
        }
    }

    // Migrate banner
    if (anime.banner && isLocalPath(anime.banner)) {
        const localPath = getLocalFilePath(anime.banner);
        
        if (anime.bannerMetadata && anime.bannerMetadata.storageProvider === 'cloudinary') {
            log(`Banner already migrated: ${anime.banner}`, 'info');
            migrationState.skipped++;
        } else if (localPath && fileExists(localPath)) {
            try {
                const metadata = await migrateImage(localPath, `anime/${animeId}/banner`);
                if (metadata) {
                    updates.banner = anime.banner;
                    updates.bannerMetadata = metadata;
                    hasChanges = true;
                    migrationState.processed++;
                }
            } catch (error) {
                migrationState.failed++;
            }
        }
    }

    // Migrate banner video
    if (anime.bannerVideo && isLocalPath(anime.bannerVideo)) {
        const localPath = getLocalFilePath(anime.bannerVideo);
        
        if (anime.bannerVideoMetadata && anime.bannerVideoMetadata.storageProvider === 'r2') {
            log(`Banner video already migrated: ${anime.bannerVideo}`, 'info');
            migrationState.skipped++;
        } else if (localPath && fileExists(localPath)) {
            try {
                const metadata = await migrateVideo(localPath, animeId);
                if (metadata) {
                    updates.bannerVideo = anime.bannerVideo;
                    updates.bannerVideoMetadata = metadata;
                    hasChanges = true;
                    migrationState.processed++;
                }
            } catch (error) {
                migrationState.failed++;
            }
        }
    }

    // Migrate trailer
    if (anime.trailer && isLocalPath(anime.trailer)) {
        const localPath = getLocalFilePath(anime.trailer);
        
        if (anime.trailerMetadata && anime.trailerMetadata.storageProvider === 'r2') {
            log(`Trailer already migrated: ${anime.trailer}`, 'info');
            migrationState.skipped++;
        } else if (localPath && fileExists(localPath)) {
            try {
                const metadata = await migrateVideo(localPath, animeId);
                if (metadata) {
                    updates.trailer = anime.trailer;
                    updates.trailerMetadata = metadata;
                    hasChanges = true;
                    migrationState.processed++;
                }
            } catch (error) {
                migrationState.failed++;
            }
        }
    }

    // Migrate episodes
    if (anime.episodes && anime.episodes.length > 0) {
        const updatedEpisodes = [];
        
        for (let i = 0; i < anime.episodes.length; i++) {
            const episode = anime.episodes[i];
            
            if (episode.url && isLocalPath(episode.url)) {
                const localPath = getLocalFilePath(episode.url);
                
                if (episode.metadata && episode.metadata.storageProvider === 'r2') {
                    log(`Episode ${i} already migrated`, 'info');
                    migrationState.skipped++;
                    updatedEpisodes.push(episode);
                } else if (localPath && fileExists(localPath)) {
                    try {
                        const metadata = await migrateVideo(localPath, animeId, i);
                        if (metadata) {
                            updatedEpisodes.push({
                                ...episode,
                                url: episode.url,
                                metadata
                            });
                            hasChanges = true;
                            migrationState.processed++;
                        } else {
                            updatedEpisodes.push(episode);
                        }
                    } catch (error) {
                        updatedEpisodes.push(episode);
                        migrationState.failed++;
                    }
                } else {
                    updatedEpisodes.push(episode);
                }
            } else {
                updatedEpisodes.push(episode);
            }
        }
        
        if (updatedEpisodes.length > 0) {
            updates.episodes = updatedEpisodes;
        }
    }

    // Migrate movies
    if (anime.movies && anime.movies.length > 0) {
        const updatedMovies = [];
        
        for (let i = 0; i < anime.movies.length; i++) {
            const movie = anime.movies[i];
            
            if (movie.url && isLocalPath(movie.url)) {
                const localPath = getLocalFilePath(movie.url);
                
                if (movie.metadata && movie.metadata.storageProvider === 'r2') {
                    log(`Movie ${i} already migrated`, 'info');
                    migrationState.skipped++;
                    updatedMovies.push(movie);
                } else if (localPath && fileExists(localPath)) {
                    try {
                        const metadata = await migrateVideo(localPath, animeId, null, i);
                        if (metadata) {
                            updatedMovies.push({
                                ...movie,
                                url: movie.url,
                                metadata
                            });
                            hasChanges = true;
                            migrationState.processed++;
                        } else {
                            updatedMovies.push(movie);
                        }
                    } catch (error) {
                        updatedMovies.push(movie);
                        migrationState.failed++;
                    }
                } else {
                    updatedMovies.push(movie);
                }
            } else {
                updatedMovies.push(movie);
            }
        }
        
        if (updatedMovies.length > 0) {
            updates.movies = updatedMovies;
        }
    }

    // Update MongoDB if there are changes
    if (hasChanges) {
        try {
            await Anime.findByIdAndUpdate(animeId, updates);
            log(`Updated anime: ${anime.title}`, 'info');
        } catch (error) {
            log(`Failed to update anime ${anime.title}: ${error.message}`, 'error');
            migrationState.failed++;
        }
    }

    migrationState.lastProcessedId = animeId;
    saveState();
}

async function migrateUser(user) {
    const userId = String(user._id);
    log(`Processing user: ${user.username} (${userId})`, 'info');

    let updates = {};
    let hasChanges = false;

    // Migrate avatar
    if (user.avatar && isLocalPath(user.avatar)) {
        const localPath = getLocalFilePath(user.avatar);
        
        if (user.avatarMetadata && user.avatarMetadata.storageProvider === 'cloudinary') {
            log(`Avatar already migrated: ${user.avatar}`, 'info');
            migrationState.skipped++;
        } else if (localPath && fileExists(localPath)) {
            try {
                const metadata = await migrateImage(localPath, `users/${userId}/avatar`);
                if (metadata) {
                    updates.avatar = user.avatar;
                    updates.avatarMetadata = metadata;
                    hasChanges = true;
                    migrationState.processed++;
                }
            } catch (error) {
                migrationState.failed++;
            }
        }
    }

    // Update MongoDB if there are changes
    if (hasChanges) {
        try {
            await User.findByIdAndUpdate(userId, updates);
            log(`Updated user: ${user.username}`, 'info');
        } catch (error) {
            log(`Failed to update user ${user.username}: ${error.message}`, 'error');
            migrationState.failed++;
        }
    }

    migrationState.lastProcessedId = userId;
    saveState();
}

async function runMigration() {
    log('Starting Anify storage migration...', 'info');
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

        // Get total counts
        const totalAnime = await Anime.countDocuments();
        const totalUsers = await User.countDocuments();
        const totalItems = totalAnime + totalUsers;

        log(`Found ${totalAnime} anime and ${totalUsers} users to process`, 'info');

        // Build query to resume from last processed item
        let animeQuery = {};
        let userQuery = {};

        if (migrationState.lastProcessedId) {
            // Resume from last processed anime
            const lastAnime = await Anime.findById(migrationState.lastProcessedId);
            if (lastAnime) {
                animeQuery = { _id: { $gt: migrationState.lastProcessedId } };
            }
        }

        // Migrate anime
        let animeCount = 0;
        const animeCursor = Anime.find(animeQuery).sort({ _id: 1 }).cursor();

        for await (const anime of animeCursor) {
            await migrateAnime(anime);
            animeCount++;
            
            // Update progress
            migrationState.progress = ((animeCount + migrationState.processed) / totalItems) * 100;
            
            if (animeCount % CONFIG.BATCH_SIZE === 0) {
                log(`Progress: ${animeCount}/${totalAnime} anime processed (${migrationState.progress.toFixed(1)}%)`, 'info');
            }
        }

        log(`Completed anime migration: ${animeCount}/${totalAnime}`, 'info');

        // Migrate users
        let userCount = 0;
        const userCursor = User.find(userQuery).sort({ _id: 1 }).cursor();

        for await (const user of userCursor) {
            await migrateUser(user);
            userCount++;
            
            // Update progress
            migrationState.progress = ((animeCount + userCount + migrationState.processed) / totalItems) * 100;
            
            if (userCount % CONFIG.BATCH_SIZE === 0) {
                log(`Progress: ${userCount}/${totalUsers} users processed (${migrationState.progress.toFixed(1)}%)`, 'info');
            }
        }

        log(`Completed user migration: ${userCount}/${totalUsers}`, 'info');

        // Generate summary
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

        log('\n=== MIGRATION SUMMARY ===', 'info');
        log(`Duration: ${summary.duration}`, 'info');
        log(`Processed: ${summary.processed}`, 'info');
        log(`Skipped: ${summary.skipped}`, 'info');
        log(`Failed: ${summary.failed}`, 'info');
        log(`Total: ${summary.total}`, 'info');
        log(`Anime: ${summary.animeProcessed}`, 'info');
        log(`Users: ${summary.usersProcessed}`, 'info');
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
