/**
 * Unified Storage Service
 * Provides a single interface for all storage operations
 * Routes to appropriate storage provider (R2 for videos, Cloudinary for images)
 * 
 * Features:
 * - Unified upload interface
 * - Automatic storage provider selection
 * - Consistent error handling
 * - Type-safe operations
 */

import * as videoStorage from './videoStorage.js';
import * as imageStorage from './imageStorage.js';
import { uploadVideo as uploadBannerVideoToCloudinary } from '../utils/cloudinaryUpload.js';

/**
 * Upload a file to the appropriate storage provider
 * 
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options
 * @param {string} options.type - Content type: 'video' or 'image'
 * @param {string} options.subtype - Subtype: 'episode', 'movie', 'trailer', 'poster', 'banner', 'thumbnail', 'avatar', etc.
 * @param {string|number} options.id - Content ID
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadFile(file, options = {}) {
  const { type } = options;
  
  if (!file || !file.buffer) {
    throw new Error('Invalid file: missing buffer');
  }
  
  // Route to appropriate storage based on file type
  if (file.mimetype?.startsWith('video/')) {
    return uploadVideo(file, options);
  } else if (file.mimetype?.startsWith('image/')) {
    return uploadImage(file, options);
  } else {
    throw new Error(`Unsupported file type: ${file.mimetype}`);
  }
}

/**
 * Upload a video (routes to videoStorage)
 */
export async function uploadVideo(file, options = {}) {
  const subtype = options.subtype || options.videoType || options.type;
  const id = options.id || options.metadata?.animeId;
  const metadata = options.metadata || {};
  
  switch (subtype) {
    case 'episode':
      return videoStorage.uploadEpisode(file, { animeId: id, ...metadata });
    case 'movie':
      return videoStorage.uploadMovie(file, { movieId: id, ...metadata });
    case 'trailer':
      return videoStorage.uploadTrailer(file, { animeId: id });
    case 'banner':
    case 'banner-video':
      return uploadBannerVideoToCloudinary(file, 'banner', { animeId: id, ...metadata });
    default:
      return videoStorage.uploadVideo(file, options);
  }
}

/**
 * Upload an image (routes to imageStorage)
 */
export async function uploadImage(file, options = {}) {
  const subtype = options.subtype || options.imageType || options.type;
  const id = options.id || options.metadata?.animeId || options.metadata?.userId;
  const metadata = options.metadata || {};
  
  switch (subtype) {
    case 'poster':
      return imageStorage.uploadPoster(file, { animeId: id });
    case 'banner':
      return imageStorage.uploadBanner(file, { animeId: id });
    case 'thumbnail':
      return imageStorage.uploadThumbnail(file, { animeId: id, ...metadata });
    case 'avatar':
      return imageStorage.uploadAvatar(file, { userId: id });
    case 'logo':
      return imageStorage.uploadLogo(file, { name: id || 'default' });
    default:
      return imageStorage.uploadImage(file, options);
  }
}

/**
 * Upload a poster
 */
export async function uploadPoster(file, options = {}) {
  return imageStorage.uploadPoster(file, options);
}

/**
 * Upload a banner
 */
export async function uploadBanner(file, options = {}) {
  return imageStorage.uploadBanner(file, options);
}

/**
 * Upload a thumbnail
 */
export async function uploadThumbnail(file, options = {}) {
  return imageStorage.uploadThumbnail(file, options);
}

/**
 * Upload an avatar
 */
export async function uploadAvatar(file, options = {}) {
  return imageStorage.uploadAvatar(file, options);
}

/**
 * Delete a video
 */
export async function deleteVideo(key) {
  return videoStorage.deleteVideo(key);
}

/**
 * Delete an image
 */
export async function deleteImage(publicId) {
  return imageStorage.deleteImage(publicId);
}

/**
 * Replace a video
 */
export async function replaceVideo(newFile, oldKey, options = {}) {
  return videoStorage.replaceVideo(newFile, oldKey, options);
}

/**
 * Replace an image
 */
export async function replaceImage(newFile, oldPublicId, options = {}) {
  return imageStorage.replaceImage(newFile, oldPublicId, options);
}

/**
 * Get a signed video URL
 */
export async function getSignedVideoUrl(key, expiresIn = 3600) {
  return videoStorage.getSignedVideoUrl(key, expiresIn);
}

/**
 * Get an optimized image URL
 */
export function getOptimizedImageUrl(publicId, transformations = {}) {
  return imageStorage.getOptimizedImageUrl(publicId, transformations);
}

/**
 * Get a thumbnail URL
 */
export function getThumbnailUrl(publicId, options = {}) {
  return imageStorage.getThumbnailUrl(publicId, options);
}

// Re-export specific functions for direct access
export {
  uploadEpisode,
  uploadMovie,
  uploadTrailer,
  uploadBannerVideo,
} from './videoStorage.js';

export {
  uploadLogo,
} from './imageStorage.js';
