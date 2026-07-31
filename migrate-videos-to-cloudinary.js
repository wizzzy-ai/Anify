import dotenv from "dotenv";
dotenv.config();

import dns from "node:dns";
  dns.setServers(["1.1.1.1", "1.0.0.1"]);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadVideo } from "./utils/cloudinaryUpload.js";
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB connection
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI not found in .env file');
  process.exit(1);
}

// Define schemas (simplified version for migration)
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

const animeSchema = new mongoose.Schema({
  title: String,
  bannerVideo: String,
  bannerVideoMetadata: { type: videoMetadataSchema, default: null },
  bannerDisplay: { type: String, default: 'image' },
}, { timestamps: true });

const Anime = mongoose.model('Anime', animeSchema);

// Upload directory
const uploadsDir = path.join(__dirname, 'uploads');

/**
 * Check if a file exists locally
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

/**
 * Get file stats
 */
function getFileStats(filePath) {
  try {
    return fs.statSync(filePath);
  } catch (error) {
    return null;
  }
}

/**
 * Upload a single video file to Cloudinary
 */
async function uploadVideoToCloudinary(filePath, animeId, animeTitle) {
  try {
    console.log(`\n📤 Uploading video for: ${animeTitle}`);
    console.log(`   File: ${path.basename(filePath)}`);

    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Create mock file object for uploadVideo function
    const mockFile = {
      buffer: fileBuffer,
      originalname: path.basename(filePath),
      mimetype: 'video/mp4',
      size: fileBuffer.length
    };

    // Upload to Cloudinary
    const result = await uploadVideo(mockFile, 'banner', { animeId });
    
    console.log(`   ✅ Upload successful!`);
    console.log(`   URL: ${result.url}`);
    console.log(`   Public ID: ${result.public_id}`);
    console.log(`   Duration: ${result.duration}s`);
    console.log(`   Size: ${(result.bytes / 1024 / 1024).toFixed(2)}MB`);

    return result;
  } catch (error) {
    console.error(`   ❌ Upload failed: ${error.message}`);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrateVideos() {
  console.log('=== Video Banner Migration to Cloudinary ===\n');
  
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // Find all anime with banner videos
    console.log('🔍 Finding anime with banner videos...');
    const animeWithVideos = await Anime.find({ 
      bannerVideo: { $exists: true, $ne: null, $ne: '' }
    });

    console.log(`Found ${animeWithVideos.length} anime with banner videos\n`);

    if (animeWithVideos.length === 0) {
      console.log('No videos to migrate. Exiting.');
      process.exit(0);
    }

    // Process each anime
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const anime of animeWithVideos) {
      try {
        const currentVideoPath = anime.bannerVideo;
        
        // Check if already migrated to Cloudinary
        if (anime.bannerVideoMetadata?.storageProvider === 'cloudinary' && anime.bannerVideoMetadata?.publicId) {
          console.log(`\n⏭️  Skipping ${anime.title} - already on Cloudinary`);
          skipCount++;
          continue;
        }

        // Check if file exists locally
        const localPath = currentVideoPath.startsWith('http') 
          ? null 
          : path.join(__dirname, currentVideoPath);

        if (localPath && !fileExists(localPath)) {
          console.log(`\n⚠️  Skipping ${anime.title} - local file not found: ${currentVideoPath}`);
          errorCount++;
          continue;
        }

        // If it's already a remote URL (not local), skip
        if (!localPath) {
          console.log(`\n⏭️  Skipping ${anime.title} - already has remote URL`);
          skipCount++;
          continue;
        }

        // Upload to Cloudinary
        const uploadResult = await uploadVideoToCloudinary(localPath, anime._id, anime.title);

        // Update database
        await Anime.findByIdAndUpdate(anime._id, {
          bannerVideo: uploadResult.url,
          bannerVideoMetadata: {
            storageProvider: 'cloudinary',
            publicId: uploadResult.public_id,
            fileSize: uploadResult.bytes,
            duration: uploadResult.duration,
            resolution: `${uploadResult.width}x${uploadResult.height}`,
            mimeType: `video/${uploadResult.format}`,
            uploadedAt: new Date()
          },
          bannerDisplay: 'video'
        });

        console.log(`   📝 Database updated`);
        successCount++;

      } catch (error) {
        console.error(`\n❌ Failed to migrate ${anime.title}: ${error.message}`);
        errorCount++;
      }
    }

    // Summary
    console.log('\n=== Migration Summary ===');
    console.log(`Total anime with videos: ${animeWithVideos.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Skipped (already on Cloudinary): ${skipCount}`);
    console.log(`Errors: ${errorCount}`);

    if (errorCount > 0) {
      console.log('\n⚠️  Some videos failed to migrate. Please check the errors above.');
    }

    process.exit(errorCount > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateVideos();
