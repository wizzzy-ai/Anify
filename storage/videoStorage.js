/**
 * Video Storage Service
 * Handles video uploads to Cloudflare R2
 * 
 * Features:
 * - Upload videos to R2 with proper folder structure
 * - Delete videos from R2
 * - Replace videos
 * - Generate signed URLs
 * - Proper error handling and logging
 */

import { uploadToR2, deleteFromR2, generateSignedDownloadUrl } from './uploadToR2.js';
import { generateVideoPath } from './uploadToR2.js';

/**
 * Upload a video to R2
 * 
 * @param {Object} file - Multer file object with buffer, originalname, mimetype, size
 * @param {Object} options - Upload options
 * @param {string} options.type - Content type: 'anime', 'movie', 'trailer', 'live-action', 'ova', 'special'
 * @param {string|number} options.id - Content ID
 * @param {Object} options.metadata - Additional metadata (season, episode, quality, etc.)
 * @param {string} options.folder - Custom folder path (overrides generated path)
 * @returns {Promise<Object>} - Upload result with url, key, metadata
 */
export async function uploadVideo(file, options = {}) {
  const { type = 'anime', id, metadata = {}, folder } = options;
  
  if (!file || !file.buffer) {
    throw new Error('Invalid file: missing buffer');
  }

  // Generate folder path if not provided
  const uploadFolder = folder || generateVideoPath(type, id, metadata);
  
  // Extract folder from the generated path (remove filename)
  const folderPath = uploadFolder.split('/').slice(0, -1).join('/');
  
  try {
    const result = await uploadToR2(file, folderPath);
    
    return {
      url: result.url,
      key: result.key,
      storageProvider: 'r2',
      metadata: {
        storageProvider: 'r2',
        storageKey: result.key,
        fileSize: result.size,
        mimeType: result.mimeType,
        uploadedAt: new Date(),
        ...metadata,
      },
    };
  } catch (error) {
    console.error('[VideoStorage] Upload failed:', error);
    throw error;
  }
}

/**
 * Upload an anime episode
 * 
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options
 * @param {string|number} options.animeId - Anime ID
 * @param {number} options.season - Season number (default: 1)
 * @param {number} options.episode - Episode number
 * @param {string} options.quality - Video quality (default: '1080p')
 * @param {string} options.language - Language: 'sub' or 'dub' (default: 'sub')
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadEpisode(file, options = {}) {
  const { animeId, season = 1, episode, quality = '1080p', language = 'sub' } = options;
  
  const folder = `videos/anime/${animeId}/season-${season}`;
  
  return uploadVideo(file, {
    type: 'anime',
    id: animeId,
    metadata: { season, episode, quality, language },
    folder,
  });
}

/**
 * Upload a movie
 * 
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options
 * @param {string|number} options.movieId - Movie ID
 * @param {string} options.quality - Video quality (default: '1080p')
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadMovie(file, options = {}) {
  const { movieId, quality = '1080p' } = options;
  
  const folder = `videos/movies/${movieId}`;
  
  return uploadVideo(file, {
    type: 'movie',
    id: movieId,
    metadata: { quality },
    folder,
  });
}

/**
 * Upload a trailer
 * 
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options
 * @param {string|number} options.animeId - Anime ID
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadTrailer(file, options = {}) {
  const { animeId } = options;
  
  const folder = `videos/trailers/${animeId}`;
  
  return uploadVideo(file, {
    type: 'trailer',
    id: animeId,
    folder,
  });
}

/**
 * Upload a banner video
 * 
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options
 * @param {string|number} options.animeId - Anime ID
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadBannerVideo(file, options = {}) {
  const { animeId } = options;
  
  const folder = `videos/banners/${animeId}`;
  
  return uploadVideo(file, {
    type: 'banner',
    id: animeId,
    folder,
  });
}

/**
 * Delete a video from R2
 * 
 * @param {string} key - R2 object key
 * @returns {Promise<void>}
 */
export async function deleteVideo(key) {
  if (!key) {
    throw new Error('Video key is required');
  }
  
  try {
    await deleteFromR2(key);
    console.log('[VideoStorage] Video deleted:', key);
  } catch (error) {
    console.error('[VideoStorage] Delete failed:', error);
    throw error;
  }
}

/**
 * Replace a video (delete old, upload new)
 * 
 * @param {Object} newFile - New file object
 * @param {string} oldKey - Old R2 object key
 * @param {Object} options - Upload options for new file
 * @returns {Promise<Object>} - New upload result
 */
export async function replaceVideo(newFile, oldKey, options = {}) {
  try {
    // Delete old video
    if (oldKey) {
      await deleteVideo(oldKey);
    }
    
    // Upload new video
    return await uploadVideo(newFile, options);
  } catch (error) {
    console.error('[VideoStorage] Replace failed:', error);
    throw error;
  }
}

/**
 * Generate a signed URL for video access
 * 
 * @param {string} key - R2 object key
 * @param {number} expiresIn - URL expiration in seconds (default: 3600)
 * @returns {Promise<string>} - Signed URL
 */
export async function getSignedVideoUrl(key, expiresIn = 3600) {
  if (!key) {
    throw new Error('Video key is required');
  }
  
  try {
    return await generateSignedDownloadUrl(key, expiresIn);
  } catch (error) {
    console.error('[VideoStorage] Failed to generate signed URL:', error);
    throw error;
  }
}

/**
 * Get video info from key
 * 
 * @param {string} key - R2 object key
 * @returns {Object} - Parsed video info
 */
export function getVideoInfoFromKey(key) {
  const parts = key.split('/');
  
  if (parts[0] !== 'videos') {
    return null;
  }
  
  const type = parts[1]; // anime, movies, trailers, banners
  const id = parts[2];
  
  return {
    type,
    id,
    key,
  };
}
