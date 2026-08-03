import { 
  PutObjectCommand, 
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";
import r2Client from "../config/r2.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Upload a video file to Cloudflare R2
 * Supports both small files (single upload) and large files (multipart upload)
 * 
 * @param {Object} file - Multer file object with buffer, originalname, mimetype
 * @param {string} folder - Folder path (e.g., "videos/anime/123/season-1")
 * @param {Object} options - Upload options
 * @param {number} options.chunkSize - Size threshold for multipart upload in bytes (default: 100MB)
 * @param {number} options.timeout - Upload timeout in milliseconds (default: 300000)
 * @returns {Promise<Object>} - Upload result with url, key, storage provider info
 */
export async function uploadToR2(file, folder = "videos", options = {}) {
  console.log('[R2 Upload] Starting upload...', { filename: file.originalname, size: file.size, mimetype: file.mimetype, folder });
  
  const { chunkSize = 100 * 1024 * 1024, timeout = 900000 } = options; // 100MB default threshold, 15 min timeout
  
  // Validate R2_PUBLIC_URL is set
  if (!process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_URL.trim() === '') {
    throw new UploadError("R2_PUBLIC_URL environment variable is not set. Please set it in your .env file.", "MISSING_R2_PUBLIC_URL");
  }
  
  if (!file || !file.buffer) {
    throw new UploadError("Invalid file: missing buffer", "INVALID_FILE");
  }

  if (!file.size || file.size <= 0) {
    throw new UploadError("Invalid file: size is zero or negative", "INVALID_FILE_SIZE");
  }

  // Check file size limit (5GB max)
  const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    throw new UploadError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024 / 1024}GB`, "FILE_TOO_LARGE");
  }

  // Validate video mime type
  const allowedMimeTypes = ['video/mp4', 'video/webm', 'video/mkv', 'video/quicktime'];
  if (!file.mimetype || !allowedMimeTypes.includes(file.mimetype)) {
    throw new UploadError(`Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}`, "INVALID_FILE_TYPE");
  }

  // Generate unique filename
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${timestamp}-${random}-${safeName}`;
  const key = `${folder}/${filename}`;

  console.log('[R2 Upload] File validated, generated key:', key);
  console.log('[R2 Upload] R2_PUBLIC_URL:', process.env.R2_PUBLIC_URL);

  try {
    // Use multipart upload for large files with timeout
    if (file.size > chunkSize) {
      console.log('[R2 Upload] Using multipart upload (large file)');
      const result = await Promise.race([
        uploadMultipart(file, key, filename),
        createTimeoutPromise(timeout)
      ]);
      console.log('[R2 Upload] Multipart upload complete:', { url: result.url, key: result.key });
      return result;
    } else {
      console.log('[R2 Upload] Using single part upload (small file)');
      const result = await Promise.race([
        uploadSingle(file, key, filename),
        createTimeoutPromise(timeout)
      ]);
      console.log('[R2 Upload] Single part upload complete:', { url: result.url, key: result.key });
      return result;
    }
  } catch (error) {
    console.error("[R2 Upload Error]:", error);
    
    if (error.name === 'TimeoutError') {
      throw new UploadError("Upload timeout. Please try again with a smaller file or better connection.", "UPLOAD_TIMEOUT");
    }
    
    if (error.name === 'NetworkError' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new UploadError("Network error. Please check your connection and try again.", "NETWORK_ERROR");
    }
    
    if (error.$metadata?.httpStatusCode === 403) {
      throw new UploadError("Authentication failed. Check R2 credentials.", "AUTH_ERROR");
    }
    
    if (error.$metadata?.httpStatusCode === 404) {
      throw new UploadError("R2 bucket not found. Check bucket configuration.", "BUCKET_NOT_FOUND");
    }
    
    throw new UploadError(`Failed to upload to R2: ${error.message}`, "UPLOAD_FAILED");
  }
}

/**
 * Custom upload error class
 */
class UploadError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
  }
}

/**
 * Create a timeout promise
 */
function createTimeoutPromise(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(`Upload timeout after ${ms}ms`);
      error.name = 'TimeoutError';
      reject(error);
    }, ms);
  });
}

/**
 * Single part upload for smaller files
 */
async function uploadSingle(file, key, filename) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await r2Client.send(command);

  const url = `${process.env.R2_PUBLIC_URL}/${key}`;

  console.log('[R2 Upload] Generated public URL:', url);

  return {
    url,
    key,
    filename,
    storage: "r2",
    size: file.size,
    mimeType: file.mimetype,
  };
}

/**
 * Multipart upload for large files
 */
async function uploadMultipart(file, key, filename) {
  console.log('[R2 Multipart] Initiating multipart upload...', { key, filename, size: file.size });
  
  const chunkSize = 100 * 1024 * 1024; // 100MB chunks
  const totalChunks = Math.ceil(file.buffer.length / chunkSize);
  console.log('[R2 Multipart] Total chunks:', totalChunks);
  
  const uploadId = await initiateMultipartUpload(key, file.mimetype);
  console.log('[R2 Multipart] Upload ID obtained:', uploadId);
  
  const partETags = [];

  try {
    // Upload each chunk
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.buffer.length);
      const chunk = file.buffer.slice(start, end);

      console.log(`[R2 Multipart] Uploading part ${i + 1}/${totalChunks}...`);
      const partETag = await uploadPart(key, uploadId, i + 1, chunk);
      partETags.push(partETag);
      console.log(`[R2 Multipart] Part ${i + 1}/${totalChunks} uploaded successfully`);
    }

    // Complete multipart upload
    console.log('[R2 Multipart] Completing multipart upload...');
    await completeMultipartUpload(key, uploadId, partETags);
    console.log('[R2 Multipart] Multipart upload completed successfully');

    const url = `${process.env.R2_PUBLIC_URL}/${key}`;

    console.log('[R2 Multipart] Generated public URL:', url);

    return {
      url,
      key,
      filename,
      storage: "r2",
      size: file.size,
      mimeType: file.mimetype,
      multipart: true,
      parts: totalChunks,
    };
  } catch (error) {
    console.error('[R2 Multipart] Error during upload, aborting:', error);
    // Abort multipart upload on error
    await abortMultipartUpload(key, uploadId);
    throw error;
  }
}

/**
 * Initiate multipart upload
 */
async function initiateMultipartUpload(key, contentType) {
  const command = new CreateMultipartUploadCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const response = await r2Client.send(command);
  return response.UploadId;
}

/**
 * Upload a single part
 */
async function uploadPart(key, uploadId, partNumber, chunk) {
  const command = new UploadPartCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
    Body: chunk,
  });

  const response = await r2Client.send(command);
  return {
    PartNumber: partNumber,
    ETag: response.ETag,
  };
}

/**
 * Complete multipart upload
 */
async function completeMultipartUpload(key, uploadId, partETags) {
  const command = new CompleteMultipartUploadCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: partETags,
    },
  });

  await r2Client.send(command);
}

/**
 * Abort multipart upload (cleanup on error)
 */
async function abortMultipartUpload(key, uploadId) {
  try {
    const command = new AbortMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      UploadId: uploadId,
    });
    await r2Client.send(command);
  } catch (error) {
    console.warn("Failed to abort multipart upload:", error);
  }
}

/**
 * Generate a signed URL for direct upload (useful for client-side uploads)
 * 
 * @param {string} key - Object key
 * @param {number} expiresIn - URL expiration in seconds (default: 3600)
 * @returns {Promise<string>} - Signed URL
 */
export async function generateSignedUploadUrl(key, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Generate a signed URL for downloading/viewing (useful for private content)
 * 
 * @param {string} key - Object key
 * @param {number} expiresIn - URL expiration in seconds (default: 3600)
 * @returns {Promise<string>} - Signed URL
 */
export async function generateSignedDownloadUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Delete a file from R2
 * 
 * @param {string} key - Object key
 * @returns {Promise<void>}
 */
export async function deleteFromR2(key) {
  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
  });

  await r2Client.send(command);
}

/**
 * Generate a unique object path based on content type
 * 
 * @param {string} type - Content type: 'anime', 'movie', 'trailer'
 * @param {string|number} id - Content ID
 * @param {Object} metadata - Additional metadata (season, episode, etc.)
 * @returns {string} - Object path
 */
export function generateVideoPath(type, id, metadata = {}) {
  const base = type === 'movie' ? 'videos/movies' : 'videos/anime';
  
  if (type === 'movie') {
    return `${base}/${id}/movie.mp4`;
  }
  
  if (type === 'anime' || type === 'animated-movie') {
    const { season = 1, episode = 1, quality = '1080p' } = metadata;
    return `${base}/${id}/season-${season}/episode-${episode}-${quality}.mp4`;
  }
  
  if (type === 'trailer') {
    return `videos/trailers/${id}.mp4`;
  }
  
  return `${base}/${id}/${Date.now()}.mp4`;
}
