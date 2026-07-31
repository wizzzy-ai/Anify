/**
 * Image Storage Service
 * Handles image uploads to Cloudinary
 * 
 * Features:
 * - Upload images to Cloudinary with proper folder structure
 * - Delete images from Cloudinary
 * - Replace images
 * - Generate optimized URLs
 * - Proper error handling and logging
 */

import { uploadToCloudinary } from './cloudinaryUpload.js';
import cloudinary from '../config/cloudinary.js';

/**
 * Upload an image to Cloudinary
 * 
 * @param {Object} file - Multer file object with buffer, originalname, mimetype
 * @param {Object} options - Upload options
 * @param {string} options.imageType - Image type: 'poster', 'banner', 'thumbnail', 'avatar', 'logo'
 * @param {string|number} options.id - Content ID (animeId, userId, etc.)
 * @param {Object} options.metadata - Additional metadata
 * @param {string} options.folder - Custom folder path (overrides generated path)
 * @returns {Promise<Object>} - Upload result with url, publicId, metadata
 */
export async function uploadImage(file, options = {}) {
  const { imageType = 'poster', id, metadata = {}, folder } = options;
  
  if (!file || !file.buffer) {
    throw new Error('Invalid file: missing buffer');
  }

  // Generate folder path if not provided
  const uploadFolder = folder || generateImagePath(imageType, id);
  
  try {
    const result = await uploadToCloudinary(file, uploadFolder, 'image');
    
    return {
      url: result.secure_url || result.url,
      publicId: result.public_id,
      storageProvider: 'cloudinary',
      metadata: {
        storageProvider: 'cloudinary',
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        uploadedAt: new Date(),
        ...metadata,
      },
    };
  } catch (error) {
    console.error('[ImageStorage] Upload failed:', error);
    throw error;
  }
}

/**
 * Upload an anime poster
 * 
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options
 * @param {string|number} options.animeId - Anime ID
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadPoster(file, options = {}) {
  const { animeId } = options;
  
  const folder = `anify/posters/${animeId}`;
  
  return uploadImage(file, {
    imageType: 'poster',
    id: animeId,
    folder,
  });
}

/**
 * Upload an anime banner
 * 
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options
 * @param {string|number} options.animeId - Anime ID
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadBanner(file, options = {}) {
  const { animeId } = options;
  
  const folder = `anify/banners/${animeId}`;
  
  return uploadImage(file, {
    imageType: 'banner',
    id: animeId,
    folder,
  });
}

/**
 * Upload an episode thumbnail
 * 
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options
 * @param {string|number} options.animeId - Anime ID
 * @param {number} options.episode - Episode number
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadThumbnail(file, options = {}) {
  const { animeId, episode } = options;
  
  const folder = `anify/thumbnails/${animeId}/${episode}`;
  
  return uploadImage(file, {
    imageType: 'thumbnail',
    id: animeId,
    metadata: { episode },
    folder,
  });
}

/**
 * Upload a user avatar
 * 
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options
 * @param {string|number} options.userId - User ID
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadAvatar(file, options = {}) {
  const { userId } = options;
  
  const folder = `anify/avatars/${userId}`;
  
  return uploadImage(file, {
    imageType: 'avatar',
    id: userId,
    folder,
  });
}

/**
 * Upload a logo
 * 
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options
 * @param {string} options.name - Logo name/identifier
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadLogo(file, options = {}) {
  const { name = 'default' } = options;
  
  const folder = `anify/logos/${name}`;
  
  return uploadImage(file, {
    imageType: 'logo',
    id: name,
    folder,
  });
}

/**
 * Delete an image from Cloudinary
 * 
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} - Deletion result
 */
export async function deleteImage(publicId) {
  if (!publicId) {
    throw new Error('Image public ID is required');
  }
  
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('[ImageStorage] Image deleted:', publicId, result);
    
    if (result.result !== 'ok') {
      throw new Error(`Failed to delete image: ${result.result}`);
    }
    
    return result;
  } catch (error) {
    console.error('[ImageStorage] Delete failed:', error);
    throw error;
  }
}

/**
 * Replace an image (delete old, upload new)
 * 
 * @param {Object} newFile - New file object
 * @param {string} oldPublicId - Old Cloudinary public ID
 * @param {Object} options - Upload options for new file
 * @returns {Promise<Object>} - New upload result
 */
export async function replaceImage(newFile, oldPublicId, options = {}) {
  try {
    // Delete old image
    if (oldPublicId) {
      await deleteImage(oldPublicId);
    }
    
    // Upload new image
    return await uploadImage(newFile, options);
  } catch (error) {
    console.error('[ImageStorage] Replace failed:', error);
    throw error;
  }
}

/**
 * Generate an optimized image URL
 * 
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} transformations - Cloudinary transformations
 * @returns {string} - Optimized URL
 */
export function getOptimizedImageUrl(publicId, transformations = {}) {
  if (!publicId) {
    throw new Error('Image public ID is required');
  }
  
  const defaultTransformations = {
    quality: 'auto',
    fetch_format: 'auto',
  };
  
  const finalTransformations = { ...defaultTransformations, ...transformations };
  
  return cloudinary.url(publicId, finalTransformations);
}

/**
 * Generate a thumbnail URL
 * 
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} options - Thumbnail options
 * @param {number} options.width - Thumbnail width (default: 400)
 * @param {number} options.height - Thumbnail height (default: 225)
 * @param {string} options.crop - Crop mode (default: 'fill')
 * @returns {string} - Thumbnail URL
 */
export function getThumbnailUrl(publicId, options = {}) {
  const { width = 400, height = 225, crop = 'fill' } = options;
  
  return getOptimizedImageUrl(publicId, {
    width,
    height,
    crop,
  });
}

/**
 * Generate an image path for Cloudinary folder structure
 * 
 * @param {string} imageType - Image type
 * @param {string|number} id - Content ID
 * @returns {string} - Folder path
 */
function generateImagePath(imageType, id) {
  const folders = {
    'poster': `anify/posters/${id}`,
    'banner': `anify/banners/${id}`,
    'thumbnail': `anify/thumbnails/${id}`,
    'avatar': `anify/avatars/${id}`,
    'logo': `anify/logos/${id}`,
  };
  
  return folders[imageType] || `anify/${imageType}/${id}`;
}

/**
 * Get image info from public ID
 * 
 * @param {string} publicId - Cloudinary public ID
 * @returns {Object} - Parsed image info
 */
export function getImageInfoFromPublicId(publicId) {
  const parts = publicId.split('/');
  
  if (parts[0] !== 'anify') {
    return null;
  }
  
  const imageType = parts[1]; // posters, banners, thumbnails, avatars, logos
  const id = parts[2];
  
  return {
    imageType,
    id,
    publicId,
  };
}
