import { uploadImage, deleteImage, replaceImage, uploadMultipleImages } from "../../../utils/cloudinaryUpload.js";

/**
 * Image Storage Service
 * Handles all image storage operations using Cloudinary
 */

/**
 * Upload an image to Cloudinary
 * 
 * @param {Object} file - Multer file object
 * @param {string} imageType - Type of image: "poster", "banner", "avatar", "thumbnail", "screenshot"
 * @param {Object} metadata - Optional metadata (animeId, userId, episodeId, etc.)
 * @returns {Promise<Object>} - Upload result with url, public_id, etc.
 */
export async function uploadImageFile(file, imageType = "poster", metadata = {}) {
  return uploadImage(file, imageType, metadata);
}

/**
 * Upload a poster image
 * 
 * @param {Object} file - Multer file object
 * @param {string|number} animeId - Anime ID
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadPoster(file, animeId) {
  return uploadImageFile(file, "poster", { animeId });
}

/**
 * Upload a banner image
 * 
 * @param {Object} file - Multer file object
 * @param {string|number} animeId - Anime ID
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadBanner(file, animeId) {
  return uploadImageFile(file, "banner", { animeId });
}

/**
 * Upload a user avatar
 * 
 * @param {Object} file - Multer file object
 * @param {string|number} userId - User ID
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadAvatar(file, userId) {
  return uploadImageFile(file, "avatar", { userId });
}

/**
 * Upload a thumbnail image
 * 
 * @param {Object} file - Multer file object
 * @param {Object} metadata - Optional metadata (animeId, episodeId)
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadThumbnail(file, metadata = {}) {
  return uploadImageFile(file, "thumbnail", metadata);
}

/**
 * Upload a screenshot image
 * 
 * @param {Object} file - Multer file object
 * @param {Object} metadata - Optional metadata (animeId, episodeId)
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadScreenshot(file, metadata = {}) {
  return uploadImageFile(file, "screenshot", metadata);
}

/**
 * Upload multiple screenshots (batch upload)
 * 
 * @param {Array} files - Array of Multer file objects
 * @param {Object} metadata - Optional metadata (animeId, episodeId)
 * @returns {Promise<Array>} - Array of upload results
 */
export async function uploadScreenshots(files, metadata = {}) {
  return uploadMultipleImages(files, "screenshot", metadata);
}

/**
 * Delete an image from Cloudinary
 * 
 * @param {string} publicId - Cloudinary public_id
 * @returns {Promise<Object>} - Deletion result
 */
export async function deleteImageFile(publicId) {
  if (!publicId) {
    throw new Error("Image public_id is required");
  }
  return deleteImage(publicId);
}

/**
 * Replace an existing image with a new one
 * 
 * @param {string} oldPublicId - Existing Cloudinary public_id
 * @param {Object} newFile - New file to upload
 * @param {string} imageType - Type of image
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<Object>} - Upload result
 */
export async function replaceImageFile(oldPublicId, newFile, imageType = "poster", metadata = {}) {
  if (!oldPublicId) {
    throw new Error("Old image public_id is required");
  }
  return replaceImage(oldPublicId, newFile, imageType, metadata);
}

/**
 * Validate image file before upload
 * 
 * @param {Object} file - Multer file object
 * @param {Object} limits - Size and type limits
 * @returns {Object} - Validation result
 */
export function validateImageFile(file, limits = {}) {
  const { maxSize = 10 * 1024 * 1024, allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'] } = limits;

  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` };
  }

  if (file.size > maxSize) {
    return { valid: false, error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB` };
  }

  return { valid: true, error: null };
}
