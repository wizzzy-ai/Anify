/**
 * Video Processing Queue
 * 
 * Manages background transcoding jobs for batch-uploaded videos.
 * Videos uploaded via batch multipart upload are queued here for
 * mobile-compatible transcoding.
 */

import { inspectVideo, isMobileCompatible, transcodeVideo, cleanupFile } from './videoTranscoder.js';
import { uploadToR2, deleteFromR2 } from './uploadToR2.js';
import Anime from '../models/Anime.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// In-memory queue (could be replaced with Redis/Bull for production)
const queue = [];
const activeJobs = new Map();
const MAX_CONCURRENT_JOBS = 6;
let isProcessing = false;

/**
 * Job status enum
 */
const JobStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Create a processing job
 */
function createJob(animeId, episodeNumber, r2Key, r2Url, quality = '1080p') {
  const jobId = `${animeId}-${episodeNumber}-${quality}-${Date.now()}`;
  const job = {
    id: jobId,
    animeId,
    episodeNumber,
    r2Key,
    r2Url,
    quality,
    status: JobStatus.PENDING,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    error: null,
    transcoded: false,
    progress: 0
  };
  queue.push(job);
  console.log('[PROCESSING QUEUE] Job created:', { jobId, animeId, episodeNumber, r2Key });
  return job;
}

/**
 * Get job by ID
 */
function getJob(jobId) {
  return queue.find(job => job.id === jobId) || activeJobs.get(jobId);
}

/**
 * Get jobs for a specific anime
 */
function getJobsForAnime(animeId) {
  return queue.filter(job => String(job.animeId) === String(animeId))
    .concat(Array.from(activeJobs.values()).filter(job => String(job.animeId) === String(animeId)));
}

/**
 * Process a single job
 */
async function processJob(job) {
  job.status = JobStatus.PROCESSING;
  job.startedAt = new Date();
  activeJobs.set(job.id, job);
  
  console.log('[PROCESSING QUEUE] Processing job:', job.id);
  
  const tempDir = path.join(os.tmpdir(), `anify-process-${job.id}`);
  const inputPath = path.join(tempDir, 'input.mp4');
  const outputPath = path.join(tempDir, 'output.mp4');
  
  try {
    await fs.mkdir(tempDir, { recursive: true });
    
    // Download video from R2
    console.log('[PROCESSING QUEUE] Downloading from R2:', job.r2Url);
    const response = await fetch(job.r2Url);
    if (!response.ok) throw new Error(`Failed to download video: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(inputPath, buffer);
    
    job.progress = 20;
    
    // Inspect video codec
    console.log('[PROCESSING QUEUE] Inspecting video codec...');
    const metadata = await inspectVideo(inputPath);
    console.log('[PROCESSING QUEUE] Video metadata:', metadata);
    
    job.progress = 40;
    
    // Check if already compatible
    if (isMobileCompatible(metadata)) {
      console.log('[PROCESSING QUEUE] Video already compatible, skipping transcoding');
      job.transcoded = false;
      job.progress = 100;
    } else {
      console.log('[PROCESSING QUEUE] Transcoding to mobile-compatible format...');
      await transcodeVideo(inputPath, outputPath, {
        onProgress: (progress) => {
          job.progress = 40 + Math.round((progress.percent || 0) * 0.5);
        }
      });
      
      job.progress = 90;
      
      // Read transcoded video
      const transcodedBuffer = await fs.readFile(outputPath);
      
      // Upload transcoded version to R2
      console.log('[PROCESSING QUEUE] Uploading transcoded video to R2...');
      const uploadResult = await uploadToR2({
        buffer: transcodedBuffer,
        originalname: `transcoded-${path.basename(job.r2Key)}`,
        size: transcodedBuffer.length,
        mimetype: 'video/mp4'
      }, 'videos', {
        metadata: {
          animeId: job.animeId,
          episodeNumber: job.episodeNumber,
          quality: job.quality,
          transcoded: true
        }
      });
      
      // Update anime with new URL
      console.log('[PROCESSING QUEUE] Updating anime with transcoded URL...');
      const anime = await Anime.findById(job.animeId);
      if (anime) {
        const episode = anime.episodesMedia?.find(ep => ep.episodeNumber === job.episodeNumber);
        if (episode) {
          const language = episode.sub?.qualities?.[job.quality] ? 'sub' : 'dub';
          episode[language].qualities.set(job.quality, uploadResult.url);
          episode[language].keys.set(job.quality, uploadResult.key);
          episode[language].sizes.set(job.quality, transcodedBuffer.length);
          episode[language].mimeTypes.set(job.quality, 'video/mp4');
          
          // Update video metadata
          if (!episode.videoMetadata) episode.videoMetadata = new Map();
          const metadataKey = `${job.quality}-${language}`;
          episode.videoMetadata.set(metadataKey, {
            url: uploadResult.url,
            key: uploadResult.key,
            storageProvider: 'r2',
            size: transcodedBuffer.length,
            mimeType: 'video/mp4',
            processingStatus: 'completed',
            transcoded: true,
            codecInfo: {
              videoCodec: 'h264',
              audioCodec: 'aac',
              pixelFormat: 'yuv420p',
              profile: 'high',
              mobileCompatible: true
            }
          });
          
          await anime.save();
          console.log('[PROCESSING QUEUE] Anime updated successfully');
        }
      }
      
      job.transcoded = true;
      job.r2Url = uploadResult.url;
      job.r2Key = uploadResult.key;
    }
    
    job.status = JobStatus.COMPLETED;
    job.completedAt = new Date();
    job.progress = 100;
    console.log('[PROCESSING QUEUE] Job completed:', job.id);
    
  } catch (error) {
    console.error('[PROCESSING QUEUE] Job failed:', job.id, error.message);
    job.status = JobStatus.FAILED;
    job.error = error.message;
    
    // Update anime with error status
    try {
      const anime = await Anime.findById(job.animeId);
      if (anime) {
        const episode = anime.episodesMedia?.find(ep => ep.episodeNumber === job.episodeNumber);
        if (episode) {
          const language = episode.sub?.qualities?.[job.quality] ? 'sub' : 'dub';
          if (!episode.videoMetadata) episode.videoMetadata = new Map();
          const metadataKey = `${job.quality}-${language}`;
          episode.videoMetadata.set(metadataKey, {
            url: job.r2Url,
            key: job.r2Key,
            storageProvider: 'r2',
            processingStatus: 'failed',
            processingError: error.message,
            codecInfo: {
              mobileCompatible: false
            }
          });
          await anime.save();
        }
      }
    } catch (dbError) {
      console.error('[PROCESSING QUEUE] Failed to update error status:', dbError.message);
    }
    
  } finally {
    // Cleanup temp files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('[PROCESSING QUEUE] Cleanup failed:', cleanupError.message);
    }
    
    activeJobs.delete(job.id);
  }
}

/**
 * Process queue (run in background)
 */
async function processQueue() {
  if (isProcessing || activeJobs.size >= MAX_CONCURRENT_JOBS) return;
  
  isProcessing = true;
  
  while (queue.length > 0 && activeJobs.size < MAX_CONCURRENT_JOBS) {
    const job = queue.shift();
    if (job.status === JobStatus.PENDING) {
      processJob(job).catch(error => {
        console.error('[PROCESSING QUEUE] Unhandled error:', error);
      });
    }
  }
  
  isProcessing = false;
  
  // Schedule next check
  setTimeout(processQueue, 1000);
}

/**
 * Start the queue processor
 */
export function startQueueProcessor() {
  console.log('[PROCESSING QUEUE] Starting queue processor...');
  processQueue();
}

/**
 * Add job to queue
 */
export function addProcessingJob(animeId, episodeNumber, r2Key, r2Url, quality = '1080p') {
  const job = createJob(animeId, episodeNumber, r2Key, r2Url, quality);
  processQueue();
  return job;
}

/**
 * Get job status
 */
export function getJobStatus(jobId) {
  return getJob(jobId);
}

/**
 * Get jobs for anime
 */
export function getAnimeJobs(animeId) {
  return getJobsForAnime(animeId);
}

/**
 * Get queue statistics
 */
export function getQueueStats() {
  return {
    pending: queue.filter(j => j.status === JobStatus.PENDING).length,
    processing: activeJobs.size,
    completed: queue.filter(j => j.status === JobStatus.COMPLETED).length,
    failed: queue.filter(j => j.status === JobStatus.FAILED).length
  };
}

export { JobStatus };
