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

function cloudinaryProgressBar(percent, width = 16) {
    const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * width);
    return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

function cloudinaryLine(icon, message) {
    console.log(`\x1b[35m${icon} ${message}\x1b[0m`);
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
        const { logContext: requestedLogContext = {}, ...cloudinaryOptions } = options;
        const logContext = requestedLogContext || {};

        cloudinaryLine('☁️', `CLOUDINARY START  •  ${file?.originalname || 'unnamed file'}  •  ${file?.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'size unknown'}`);
        console.log('   📁 Folder:', folder, '• 🧩 Type:', resourceType, '• 🍥 Anime:', logContext.animeTitle || logContext.title || 'not provided');

        // Validate file
        if (!file || !file.buffer) {
            return reject(new CloudinaryUploadError("Invalid file: missing buffer", "INVALID_FILE"));
        }

        if (!file.size || file.size <= 0) {
            return reject(new CloudinaryUploadError("Invalid file: size is zero or negative", "INVALID_FILE_SIZE"));
        }

        // Check file size limit based on resource type
        const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images
        const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB for videos
        
        if (resourceType === "image" && file.size > MAX_IMAGE_SIZE) {
            return reject(new CloudinaryUploadError(`Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB`, "FILE_TOO_LARGE"));
        }
        
        if (resourceType === "video" && file.size > MAX_VIDEO_SIZE) {
            return reject(new CloudinaryUploadError(`Video too large. Maximum size is ${MAX_VIDEO_SIZE / 1024 / 1024}MB`, "FILE_TOO_LARGE"));
        }

        // Validate mime type for images
        if (resourceType === "image") {
            const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
            if (!file.mimetype || !allowedMimeTypes.includes(file.mimetype)) {
                return reject(new CloudinaryUploadError(`Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}`, "INVALID_FILE_TYPE"));
            }
        }

        // Validate mime type for videos
        if (resourceType === "video") {
            const allowedMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
            if (!file.mimetype || !allowedMimeTypes.includes(file.mimetype)) {
                return reject(new CloudinaryUploadError(`Invalid video type. Allowed: ${allowedMimeTypes.join(', ')}`, "INVALID_FILE_TYPE"));
            }
        }

        const uploadOptions = {
            folder,
            resource_type: resourceType,
            ...cloudinaryOptions
        };

        console.log('   ⚙️ Cloudinary stream is connected — transferring your file...');

        const stream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) {
                    console.error("Cloudinary Upload Error:", error);
                    
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

                cloudinaryLine('🎉', `CLOUDINARY COMPLETE  •  ${file.originalname}  •  ${(result.bytes / 1024 / 1024).toFixed(2)} MB saved`);
                console.log('   🔗 URL:', result.secure_url);
                console.log('   🏷️ Public ID:', result.public_id);
                resolve(result);
            }
        );

        // Handle stream errors
        stream.on('error', (error) => {
            console.error("Cloudinary Stream Error:", error);
            reject(new CloudinaryUploadError(`Stream error: ${error.message}`, "STREAM_ERROR"));
        });

        const readStream = streamifier.createReadStream(file.buffer);
        let bytesSent = 0;
        let lastLoggedProgress = -1;
        const totalBytes = file.size;

        readStream.on('data', (chunk) => {
            bytesSent += chunk.length;
            const progress = Math.min(100, (bytesSent / totalBytes) * 100);
            const progressBucket = Math.floor(progress / 5) * 5;

            if (progressBucket > lastLoggedProgress || progress >= 100) {
                lastLoggedProgress = progressBucket;
                cloudinaryLine('☁️', `Server → Cloudinary  ${cloudinaryProgressBar(progress)}  ${progress.toFixed(0)}%  •  ${(bytesSent / 1024 / 1024).toFixed(2)} / ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
            }
        });

        readStream.on('end', () => {
            cloudinaryLine('⏳', `File sent to Cloudinary — waiting for confirmation: ${file.originalname}`);
        });

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
        logContext: metadata,
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

/**
 * Upload a video to Cloudinary
 * 
 * @param {Object} file - Multer file object
 * @param {string} videoType - Type of video: "banner", "trailer", "episode"
 * @param {Object} metadata - Optional metadata (animeId, episodeId, etc.)
 * @returns {Promise<Object>} - Upload result with url, public_id, etc.
 */
export async function uploadVideo(file, videoType = "banner", metadata = {}) {
    const folderMap = {
        banner: "anify/banner-videos",
        trailer: "anify/trailers",
        episode: "anify/episodes",
    };

    const folder = folderMap[videoType] || "anify/videos";
    
    // Add metadata to upload
    const options = {
        public_id: generateVideoPublicId(videoType, metadata),
        logContext: metadata,
        ...metadata
    };

    const result = await uploadToCloudinary(file, folder, "video", options);

    return {
        url: result.secure_url,
        public_id: result.public_id,
        storage: "cloudinary",
        duration: result.duration,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        videoType,
    };
}

/**
 * Delete a video from Cloudinary
 * 
 * @param {string} publicId - Cloudinary public_id
 * @returns {Promise<Object>} - Deletion result
 */
export async function deleteVideo(publicId) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(publicId, { resource_type: 'video' }, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
    });
}

/**
 * Replace an existing video with a new one
 * 
 * @param {string} oldPublicId - Existing Cloudinary public_id
 * @param {Object} newFile - New file to upload
 * @param {string} videoType - Type of video
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<Object>} - Upload result
 */
export async function replaceVideo(oldPublicId, newFile, videoType = "banner", metadata = {}) {
    // Delete old video
    try {
        await deleteVideo(oldPublicId);
    } catch (error) {
        console.warn("Failed to delete old video:", error);
        // Continue with upload even if deletion fails
    }

    // Upload new video
    return await uploadVideo(newFile, videoType, metadata);
}

/**
 * Generate a unique public_id for Cloudinary videos
 * 
 * @param {string} videoType - Type of video
 * @param {Object} metadata - Metadata with ids
 * @returns {string} - Generated public_id
 */
function generateVideoPublicId(videoType, metadata = {}) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    
    if (metadata.animeId) {
        return `${videoType}_${metadata.animeId}_${timestamp}`;
    }
    
    if (metadata.userId) {
        return `${videoType}_user_${metadata.userId}_${timestamp}`;
    }
    
    if (metadata.episodeId) {
        return `${videoType}_ep_${metadata.episodeId}_${timestamp}`;
    }
    
    return `${videoType}_${timestamp}_${random}`;
}

/**
 * Get optimized URL for a video
 * 
 * @param {string} publicId - Cloudinary public_id
 * @param {Object} options - Transformation options
 * @returns {string} - Optimized URL
 */
export function getOptimizedVideoUrl(publicId, options = {}) {
    return cloudinary.url(publicId, {
        resource_type: 'video',
        ...options
    });
}
