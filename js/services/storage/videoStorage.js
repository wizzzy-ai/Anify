import { uploadToR2, deleteFromR2, generateVideoPath, generateSignedDownloadUrl } from "../../../utils/uploadToR2.js";

/**
 * Video Storage Service
 * Handles all video storage operations using Cloudflare R2
 */

/**
 * Upload a video file to R2
 * 
 * @param {Object} file - Multer file object
 * @param {Object} metadata - Video metadata (type, id, season, episode, quality)
 * @returns {Promise<Object>} - Upload result with url, key, etc.
 */
export async function uploadVideo(file, metadata = {}) {
  const { type = 'anime', id, season = 1, episode = 1, quality = '1080p' } = metadata;
  
  if (!id) {
    throw new Error("Video ID is required");
  }

  // Generate structured path
  const folder = generateVideoPath(type, id, { season, episode, quality }).split('/').slice(0, -1).join('/');
  
  const result = await uploadToR2(file, folder);

  return {
    ...result,
    metadata: {
      type,
      id,
      season,
      episode,
      quality,
    },
  };
}

/**
 * Upload a movie video
 * 
 * @param {Object} file - Multer file object
 * @param {string|number} movieId - Movie ID
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadMovieVideo(file, movieId) {
  return uploadVideo(file, {
    type: 'movie',
    id: movieId,
  });
}

/**
 * Upload an anime episode video
 * 
 * @param {Object} file - Multer file object
 * @param {string|number} animeId - Anime ID
 * @param {number} season - Season number
 * @param {number} episode - Episode number
 * @param {string} quality - Video quality (1080p, 720p, etc.)
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadEpisodeVideo(file, animeId, season = 1, episode = 1, quality = '1080p') {
  return uploadVideo(file, {
    type: 'anime',
    id: animeId,
    season,
    episode,
    quality,
  });
}

/**
 * Upload a trailer video
 * 
 * @param {Object} file - Multer file object
 * @param {string|number} contentId - Content ID
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadTrailerVideo(file, contentId) {
  const folder = `videos/trailers`;
  const result = await uploadToR2(file, folder);

  return {
    ...result,
    metadata: {
      type: 'trailer',
      id: contentId,
    },
  };
}

/**
 * Delete a video from R2
 * 
 * @param {string} key - R2 object key
 * @returns {Promise<void>}
 */
export async function deleteVideo(key) {
  if (!key) {
    throw new Error("Video key is required");
  }
  await deleteFromR2(key);
}

/**
 * Generate a signed URL for video playback (for private content)
 * 
 * @param {string} key - R2 object key
 * @param {number} expiresIn - URL expiration in seconds (default: 3600)
 * @returns {Promise<string>} - Signed URL
 */
export async function getVideoPlaybackUrl(key, expiresIn = 3600) {
  if (!key) {
    throw new Error("Video key is required");
  }
  return generateSignedDownloadUrl(key, expiresIn);
}

/**
 * Get public video URL (for public content)
 * 
 * @param {string} key - R2 object key
 * @returns {string} - Public URL
 */
export function getPublicVideoUrl(key) {
  if (!key) {
    throw new Error("Video key is required");
  }
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

/**
 * Validate video file before upload
 * 
 * @param {Object} file - Multer file object
 * @param {Object} limits - Size and type limits
 * @returns {Object} - Validation result
 */
export function validateVideoFile(file, limits = {}) {
  const { maxSize = 5 * 1024 * 1024 * 1024, allowedTypes = ['video/mp4', 'video/webm', 'video/mkv'] } = limits;

  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` };
  }

  if (file.size > maxSize) {
    return { valid: false, error: `File too large. Maximum size: ${maxSize / 1024 / 1024 / 1024}GB` };
  }

  return { valid: true, error: null };
}
