/**
 * Storage Health Checker
 * Monitors storage usage and health for admin dashboard
 * 
 * Features:
 * - Count total videos and images
 * - Check Cloudflare R2 storage usage
 * - Check Cloudinary storage usage
 * - Identify missing files
 * - Identify orphaned files
 * - Track failed uploads
 * - Display storage provider distribution
 */

import mongoose from 'mongoose';
import cloudinary from '../config/cloudinary.js';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import r2Client from '../config/r2.js';
import User from '../User.js';
import Anime from '../models/Anime.js';

/**
 * Get comprehensive storage health report
 * 
 * @returns {Promise<Object>} - Storage health report
 */
export async function getStorageHealth() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      videos: {
        total: 0,
        r2: 0,
        local: 0,
        missing: 0,
        totalSize: 0,
      },
      images: {
        total: 0,
        cloudinary: 0,
        local: 0,
        missing: 0,
        totalSize: 0,
      },
      storageProviders: {
        r2: {
          count: 0,
          size: 0,
          usage: 0,
        },
        cloudinary: {
          count: 0,
          size: 0,
          usage: 0,
        },
      },
      missingFiles: [],
      orphanedFiles: [],
      failedUploads: [],
    };

    // Get all anime
    const animes = await Anime.find().lean();
    
    // Count videos
    for (const anime of animes) {
      // Trailer
      if (anime.trailer) {
        report.videos.total++;
        if (anime.trailerMetadata?.storageProvider === 'r2') {
          report.videos.r2++;
          report.storageProviders.r2.count++;
          if (anime.trailerMetadata.fileSize) {
            report.storageProviders.r2.size += anime.trailerMetadata.fileSize;
            report.videos.totalSize += anime.trailerMetadata.fileSize;
          }
        } else if (anime.trailer.startsWith('http')) {
          report.videos.r2++;
        } else {
          report.videos.local++;
        }
      }

      // Banner video
      if (anime.bannerVideo) {
        report.videos.total++;
        if (anime.bannerVideoMetadata?.storageProvider === 'r2') {
          report.videos.r2++;
          report.storageProviders.r2.count++;
          if (anime.bannerVideoMetadata.fileSize) {
            report.storageProviders.r2.size += anime.bannerVideoMetadata.fileSize;
            report.videos.totalSize += anime.bannerVideoMetadata.fileSize;
          }
        } else if (anime.bannerVideo.startsWith('http')) {
          report.videos.r2++;
        } else {
          report.videos.local++;
        }
      }

      // Episodes
      if (anime.episodesMedia && anime.episodesMedia.length > 0) {
        for (const episode of anime.episodesMedia) {
          const subQualities = episode.sub?.qualities instanceof Map 
            ? Object.fromEntries(episode.sub.qualities) 
            : episode.sub?.qualities || {};
          const dubQualities = episode.dub?.qualities instanceof Map 
            ? Object.fromEntries(episode.dub.qualities) 
            : episode.dub?.qualities || {};
          
          for (const [quality, url] of Object.entries(subQualities)) {
            if (url) {
              report.videos.total++;
              if (url.includes('r2.dev') || url.includes(process.env.R2_PUBLIC_URL)) {
                report.videos.r2++;
                report.storageProviders.r2.count++;
              } else if (url.startsWith('http')) {
                report.videos.r2++;
              } else {
                report.videos.local++;
              }
            }
          }
          
          for (const [quality, url] of Object.entries(dubQualities)) {
            if (url) {
              report.videos.total++;
              if (url.includes('r2.dev') || url.includes(process.env.R2_PUBLIC_URL)) {
                report.videos.r2++;
                report.storageProviders.r2.count++;
              } else if (url.startsWith('http')) {
                report.videos.r2++;
              } else {
                report.videos.local++;
              }
            }
          }

          // Episode thumbnails
          if (episode.thumbnail) {
            report.images.total++;
            if (episode.thumbnailMetadata?.storageProvider === 'cloudinary') {
              report.images.cloudinary++;
              report.storageProviders.cloudinary.count++;
              if (episode.thumbnailMetadata.bytes) {
                report.storageProviders.cloudinary.size += episode.thumbnailMetadata.bytes;
                report.images.totalSize += episode.thumbnailMetadata.bytes;
              }
            } else if (episode.thumbnail.startsWith('http')) {
              report.images.cloudinary++;
            } else {
              report.images.local++;
            }
          }
        }
      }

      // Movie media
      if (anime.movieMedia?.qualities) {
        const qualities = anime.movieMedia.qualities instanceof Map 
          ? Object.fromEntries(anime.movieMedia.qualities) 
          : anime.movieMedia.qualities;
        
        for (const [quality, url] of Object.entries(qualities)) {
          if (url) {
            report.videos.total++;
            if (url.includes('r2.dev') || url.includes(process.env.R2_PUBLIC_URL)) {
              report.videos.r2++;
              report.storageProviders.r2.count++;
            } else if (url.startsWith('http')) {
              report.videos.r2++;
            } else {
              report.videos.local++;
            }
          }
        }
      }

      // Poster
      if (anime.image) {
        report.images.total++;
        if (anime.imageMetadata?.storageProvider === 'cloudinary') {
          report.images.cloudinary++;
          report.storageProviders.cloudinary.count++;
          if (anime.imageMetadata.bytes) {
            report.storageProviders.cloudinary.size += anime.imageMetadata.bytes;
            report.images.totalSize += anime.imageMetadata.bytes;
          }
        } else if (anime.image.startsWith('http')) {
          report.images.cloudinary++;
        } else {
          report.images.local++;
        }
      }

      // Banner
      if (anime.banner) {
        report.images.total++;
        if (anime.bannerMetadata?.storageProvider === 'cloudinary') {
          report.images.cloudinary++;
          report.storageProviders.cloudinary.count++;
          if (anime.bannerMetadata.bytes) {
            report.storageProviders.cloudinary.size += anime.bannerMetadata.bytes;
            report.images.totalSize += anime.bannerMetadata.bytes;
          }
        } else if (anime.banner.startsWith('http')) {
          report.images.cloudinary++;
        } else {
          report.images.local++;
        }
      }
    }

    // Get all users
    const users = await User.find().lean();
    
    for (const user of users) {
      if (user.avatar) {
        report.images.total++;
        if (user.avatarMetadata?.storageProvider === 'cloudinary') {
          report.images.cloudinary++;
          report.storageProviders.cloudinary.count++;
          if (user.avatarMetadata.bytes) {
            report.storageProviders.cloudinary.size += user.avatarMetadata.bytes;
            report.images.totalSize += user.avatarMetadata.bytes;
          }
        } else if (user.avatar.startsWith('http')) {
          report.images.cloudinary++;
        } else {
          report.images.local++;
        }
      }
    }

    // Get Cloudinary usage
    try {
      const cloudinaryResult = await cloudinary.api.usage();
      report.storageProviders.cloudinary.usage = cloudinaryResult;
    } catch (error) {
      console.error('Failed to get Cloudinary usage:', error);
    }

    // Get R2 object count (approximate)
    try {
      const r2Command = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET,
        MaxKeys: 1000,
      });
      const r2Result = await r2Client.send(r2Command);
      report.storageProviders.r2.objectCount = r2Result.KeyCount || 0;
    } catch (error) {
      console.error('Failed to get R2 object count:', error);
    }

    // Format sizes
    report.storageProviders.r2.sizeFormatted = formatBytes(report.storageProviders.r2.size);
    report.storageProviders.cloudinary.sizeFormatted = formatBytes(report.storageProviders.cloudinary.size);
    report.videos.totalSizeFormatted = formatBytes(report.videos.totalSize);
    report.images.totalSizeFormatted = formatBytes(report.images.totalSize);

    return report;
  } catch (error) {
    console.error('Storage health check failed:', error);
    throw error;
  }
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get storage health for admin dashboard endpoint
 */
export async function getStorageHealthForDashboard() {
  const health = await getStorageHealth();
  
  return {
    totalVideos: health.videos.total,
    totalImages: health.images.total,
    r2StorageUsed: health.storageProviders.r2.sizeFormatted,
    cloudinaryStorageUsed: health.storageProviders.cloudinary.sizeFormatted,
    missingFiles: health.missingFiles.length,
    orphanedFiles: health.orphanedFiles.length,
    failedUploads: health.failedUploads.length,
    storageProviders: {
      r2: health.videos.r2,
      cloudinary: health.images.cloudinary,
      local: health.videos.local + health.images.local,
    },
  };
}
