import * as videoStorage from "./videoStorage.js";
import * as imageStorage from "./imageStorage.js";

/**
 * Unified Storage Service
 * Single entry point for all storage operations
 * Routes to appropriate storage provider (R2 for videos, Cloudinary for images)
 */

/**
 * Upload a file (auto-detects type)
 * 
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options (type, metadata, etc.)
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadFile(file, options = {}) {
  if (!file) {
    throw new Error("File is required");
  }

  const isVideo = file.mimetype?.startsWith("video");
  const isImage = file.mimetype?.startsWith("image");

  if (isVideo) {
    return uploadVideo(file, options);
  }

  if (isImage) {
    return uploadImage(file, options);
  }

  throw new Error("Unsupported file type");
}

/**
 * Upload a video file
 * 
 * @param {Object} file - Multer file object
 * @param {Object} options - Video options (type, id, season, episode, quality)
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadVideo(file, options = {}) {
  const { type = 'anime', id, season = 1, episode = 1, quality = '1080p' } = options;

  // Validate video file
  const validation = videoStorage.validateVideoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Route to appropriate upload method
  if (type === 'movie') {
    return videoStorage.uploadMovieVideo(file, id);
  }

  if (type === 'trailer') {
    return videoStorage.uploadTrailerVideo(file, id);
  }

  // Default to anime episode
  return videoStorage.uploadEpisodeVideo(file, id, season, episode, quality);
}

/**
 * Upload an image file
 * 
 * @param {Object} file - Multer file object
 * @param {Object} options - Image options (imageType, metadata)
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadImage(file, options = {}) {
  const { imageType = 'poster', metadata = {} } = options;

  // Validate image file
  const validation = imageStorage.validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return imageStorage.uploadImageFile(file, imageType, metadata);
}

/**
 * Upload a poster
 * 
 * @param {Object} file - Multer file object
 * @param {string|number} animeId - Anime ID
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadPoster(file, animeId) {
  return imageStorage.uploadPoster(file, animeId);
}

/**
 * Upload a banner
 * 
 * @param {Object} file - Multer file object
 * @param {string|number} animeId - Anime ID
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadBanner(file, animeId) {
  return imageStorage.uploadBanner(file, animeId);
}

/**
 * Upload an avatar
 * 
 * @param {Object} file - Multer file object
 * @param {string|number} userId - User ID
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadAvatar(file, userId) {
  return imageStorage.uploadAvatar(file, userId);
}

/**
 * Upload a thumbnail
 * 
 * @param {Object} file - Multer file object
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadThumbnail(file, metadata = {}) {
  return imageStorage.uploadThumbnail(file, metadata);
}

/**
 * Upload screenshots (batch)
 * 
 * @param {Array} files - Array of Multer file objects
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<Array>} - Array of upload results
 */
export async function uploadScreenshots(files, metadata = {}) {
  return imageStorage.uploadScreenshots(files, metadata);
}

/**
 * Delete a file (auto-detects type)
 * 
 * @param {string} identifier - File identifier (key for R2, public_id for Cloudinary)
 * @param {string} storageProvider - Storage provider: "r2" or "cloudinary"
 * @returns {Promise<void>}
 */
export async function deleteFile(identifier, storageProvider) {
  if (!identifier) {
    throw new Error("File identifier is required");
  }

  if (storageProvider === "r2") {
    return videoStorage.deleteVideo(identifier);
  }

  if (storageProvider === "cloudinary") {
    return imageStorage.deleteImageFile(identifier);
  }

  throw new Error("Invalid storage provider");
}

/**
 * Delete a video
 * 
 * @param {string} key - R2 object key
 * @returns {Promise<void>}
 */
export async function deleteVideo(key) {
  return videoStorage.deleteVideo(key);
}

/**
 * Delete an image
 * 
 * @param {string} publicId - Cloudinary public_id
 * @returns {Promise<Object>}
 */
export async function deleteImage(publicId) {
  return imageStorage.deleteImageFile(publicId);
}

/**
 * Replace an image
 * 
 * @param {string} oldPublicId - Existing Cloudinary public_id
 * @param {Object} newFile - New file to upload
 * @param {string} imageType - Type of image
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<Object>} - Upload result
 */
export async function replaceImage(oldPublicId, newFile, imageType = "poster", metadata = {}) {
  return imageStorage.replaceImageFile(oldPublicId, newFile, imageType, metadata);
}

/**
 * Get a video URL
 * 
 * @param {string} key - R2 object key
 * @param {boolean} signed - Whether to generate a signed URL
 * @param {number} expiresIn - URL expiration in seconds (for signed URLs)
 * @returns {Promise<string>|string} - Video URL
 */
export async function getVideoUrl(key, signed = false, expiresIn = 3600) {
  if (!key) {
    throw new Error("Video key is required");
  }

  if (signed) {
    return videoStorage.getVideoPlaybackUrl(key, expiresIn);
  }

  return videoStorage.getPublicVideoUrl(key);
}

/**
 * Validate a file before upload
 * 
 * @param {Object} file - Multer file object
 * @param {string} fileType - Expected file type: "video" or "image"
 * @param {Object} limits - Size and type limits
 * @returns {Object} - Validation result
 */
export function validateFile(file, fileType = "auto", limits = {}) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  const isVideo = file.mimetype?.startsWith("video");
  const isImage = file.mimetype?.startsWith("image");

  if (fileType === "auto") {
    if (isVideo) return videoStorage.validateVideoFile(file, limits);
    if (isImage) return imageStorage.validateImageFile(file, limits);
    return { valid: false, error: 'Unsupported file type' };
  }

  if (fileType === "video") {
    return videoStorage.validateVideoFile(file, limits);
  }

  if (fileType === "image") {
    return imageStorage.validateImageFile(file, limits);
  }

  return { valid: false, error: 'Invalid file type specified' };
}

// Export all storage modules for advanced usage
export { videoStorage, imageStorage };
