import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";

/**
 * Custom upload error class
 */
class CloudinaryUploadError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CloudinaryUploadError';
    this.code = code;
  }
}

/**
 * Upload a file to Cloudinary
 * 
 * @param {Object} file - Multer file object with buffer, originalname, mimetype
 * @param {string} folder - Cloudinary folder (e.g., "anify/posters")
 * @param {string} resourceType - Resource type: "image", "video", "auto"
 * @param {Object} options - Additional Cloudinary upload options
 * @returns {Promise<Object>} - Upload result
 */
export function uploadToCloudinary(file, folder, resourceType = "auto", options = {}) {
    return new Promise((resolve, reject) => {
        console.log('[CLOUDINARY UPLOAD] Starting upload:', {
            filename: file.originalname,
            size: (file.size / 1024 / 1024).toFixed(2) + 'MB',
            mimetype: file.mimetype,
            folder: folder,
            resourceType: resourceType
        });

        // Validate file
        if (!file || !file.buffer) {
            console.error('[CLOUDINARY UPLOAD] Invalid file: missing buffer');
            return reject(new CloudinaryUploadError("Invalid file: missing buffer", "INVALID_FILE"));
        }

        if (!file.size || file.size <= 0) {
            console.error('[CLOUDINARY UPLOAD] Invalid file: size is zero or negative');
            return reject(new CloudinaryUploadError("Invalid file: size is zero or negative", "INVALID_FILE_SIZE"));
        }

        // Check file size limit (10MB max for images)
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            console.error('[CLOUDINARY UPLOAD] File too large:', (file.size / 1024 / 1024).toFixed(2) + 'MB');
            return reject(new CloudinaryUploadError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`, "FILE_TOO_LARGE"));
        }

        // Validate mime type for images
        if (resourceType === "image") {
            const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
            if (!file.mimetype || !allowedMimeTypes.includes(file.mimetype)) {
                console.error('[CLOUDINARY UPLOAD] Invalid file type:', file.mimetype);
                return reject(new CloudinaryUploadError(`Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}`, "INVALID_FILE_TYPE"));
            }
        }

        const uploadOptions = {
            folder,
            resource_type: resourceType,
            ...options
        };

        console.log('[CLOUDINARY UPLOAD] Upload options:', uploadOptions);

        const stream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) {
                    console.error('[CLOUDINARY UPLOAD] Upload failed:', error);
                    
                    // Handle specific Cloudinary errors
                    if (error.http_code === 401) {
                        return reject(new CloudinaryUploadError("Authentication failed. Check Cloudinary credentials.", "AUTH_ERROR"));
                    }
                    
                    if (error.http_code === 400) {
                        return reject(new CloudinaryUploadError(`Bad request: ${error.message}`, "BAD_REQUEST"));
                    }
                    
                    if (error.http_code === 415) {
                        return reject(new CloudinaryUploadError("Unsupported file type.", "UNSUPPORTED_TYPE"));
                    }
                    
                    if (error.http_code === 413) {
                        return reject(new CloudinaryUploadError("File too large for Cloudinary.", "FILE_TOO_LARGE"));
                    }
                    
                    return reject(new CloudinaryUploadError(`Cloudinary upload failed: ${error.message}`, "UPLOAD_FAILED"));
                }
                
                console.log('[CLOUDINARY UPLOAD] Upload successful:', {
                    url: result.secure_url,
                    public_id: result.public_id,
                    resource_type: result.resource_type,
                    bytes: result.bytes,
                    width: result.width,
                    height: result.height
                });
                
                resolve(result);
            }
        );

        // Handle stream errors
        stream.on('error', (error) => {
            console.error('[CLOUDINARY UPLOAD] Stream error:', error);
            reject(new CloudinaryUploadError(`Stream error: ${error.message}`, "STREAM_ERROR"));
        });

        // Add progress tracking for the stream
        const readStream = streamifier.createReadStream(file.buffer);
        let bytesUploaded = 0;
        const totalBytes = file.size;

        readStream.on('data', (chunk) => {
            bytesUploaded += chunk.length;
            const progress = (bytesUploaded / totalBytes) * 100;
            const uploadedMB = (bytesUploaded / 1024 / 1024).toFixed(2);
            const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
            console.log(`[CLOUDINARY UPLOAD] Progress: ${progress.toFixed(1)}% (${uploadedMB}MB / ${totalMB}MB)`);
        });

        readStream.on('end', () => {
            console.log('[CLOUDINARY UPLOAD] Stream complete, waiting for Cloudinary response...');
        });

        readStream.on('error', (error) => {
            console.error('[CLOUDINARY UPLOAD] Read stream error:', error);
        });

        console.log('[CLOUDINARY UPLOAD] Starting stream upload...');
        readStream.pipe(stream);
    });
}

/**
 * Upload an image to Cloudinary with optimized settings
 * 
 * @param {Object} file - Multer file object
 * @param {string} imageType - Type of image: "poster", "banner", "avatar", "thumbnail", "screenshot"
 * @param {Object} metadata - Optional metadata (animeId, userId, etc.)
 * @returns {Promise<Object>} - Upload result with url, public_id, etc.
 */
export async function uploadImage(file, imageType = "poster", metadata = {}) {
    const folderMap = {
        poster: "anify/posters",
        banner: "anify/banners",
        avatar: "anify/avatars",
        thumbnail: "anify/thumbnails",
        screenshot: "anify/screenshots",
    };

    const folder = folderMap[imageType] || "anify/images";
    
    // Add metadata to upload
    const options = {
        transformation: getTransformationForType(imageType),
        public_id: generatePublicId(imageType, metadata),
        ...metadata
    };

    const result = await uploadToCloudinary(file, folder, "image", options);

    return {
        url: result.secure_url,
        public_id: result.public_id,
        storage: "cloudinary",
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        imageType,
    };
}

/**
 * Delete an image from Cloudinary
 * 
 * @param {string} publicId - Cloudinary public_id
 * @returns {Promise<Object>} - Deletion result
 */
export async function deleteImage(publicId) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(publicId, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
    });
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
export async function replaceImage(oldPublicId, newFile, imageType = "poster", metadata = {}) {
    // Delete old image
    try {
        await deleteImage(oldPublicId);
    } catch (error) {
        console.warn("Failed to delete old image:", error);
        // Continue with upload even if deletion fails
    }

    // Upload new image
    return await uploadImage(newFile, imageType, metadata);
}

/**
 * Get Cloudinary transformation settings based on image type
 * 
 * @param {string} imageType - Type of image
 * @returns {Object} - Cloudinary transformation options
 */
function getTransformationForType(imageType) {
    const transformations = {
        poster: [
            { width: 400, height: 600, crop: "fill", quality: "auto" },
            { fetch_format: "auto" }
        ],
        banner: [
            { width: 1920, height: 600, crop: "fill", quality: "auto" },
            { fetch_format: "auto" }
        ],
        avatar: [
            { width: 200, height: 200, crop: "thumb", gravity: "face", quality: "auto" },
            { fetch_format: "auto" }
        ],
        thumbnail: [
            { width: 320, height: 180, crop: "fill", quality: "auto" },
            { fetch_format: "auto" }
        ],
        screenshot: [
            { quality: "auto" },
            { fetch_format: "auto" }
        ],
    };

    return transformations[imageType] || [];
}

/**
 * Generate a unique public_id for Cloudinary
 * 
 * @param {string} imageType - Type of image
 * @param {Object} metadata - Metadata with ids
 * @returns {string} - Generated public_id
 */
function generatePublicId(imageType, metadata = {}) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    
    if (metadata.animeId) {
        return `${imageType}_${metadata.animeId}_${timestamp}`;
    }
    
    if (metadata.userId) {
        return `${imageType}_user_${metadata.userId}_${timestamp}`;
    }
    
    if (metadata.episodeId) {
        return `${imageType}_ep_${metadata.episodeId}_${timestamp}`;
    }
    
    return `${imageType}_${timestamp}_${random}`;
}

/**
 * Get optimized URL for an image
 * 
 * @param {string} publicId - Cloudinary public_id
 * @param {Object} options - Transformation options
 * @returns {string} - Optimized URL
 */
export function getOptimizedImageUrl(publicId, options = {}) {
    return cloudinary.url(publicId, {
        quality: "auto",
        fetch_format: "auto",
        ...options
    });
}

/**
 * Upload multiple images (batch upload)
 * 
 * @param {Array} files - Array of Multer file objects
 * @param {string} imageType - Type of images
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<Array>} - Array of upload results
 */
export async function uploadMultipleImages(files, imageType = "screenshot", metadata = {}) {
    const uploadPromises = files.map((file, index) => {
        const fileMetadata = { ...metadata, index };
        return uploadImage(file, imageType, fileMetadata);
    });

    return Promise.all(uploadPromises);
}
