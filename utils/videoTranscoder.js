/**
 * Video Transcoding Service
 * Ensures all videos are mobile-compatible (H.264 + AAC + yuv420p)
 * 
 * Target Format:
 * - Container: MP4
 * - Video Codec: H.264/AVC
 * - Audio Codec: AAC
 * - Pixel Format: yuv420p
 * - Profile: High (compatible with mobile)
 * - Level: Auto (based on resolution)
 * 
 * This service inspects videos and only transcodes if necessary.
 */

import ffmpeg from 'fluent-ffmpeg';
import { createReadStream, createWriteStream, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Inspect video codec information using ffprobe
 * 
 * @param {string} inputPath - Path to video file
 * @returns {Promise<Object>} - Video metadata
 */
export async function inspectVideo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(new Error(`FFprobe failed: ${err.message}`));
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      resolve({
        container: metadata.format.format_name,
        videoCodec: videoStream.codec_name,
        audioCodec: audioStream?.codec_name || null,
        pixelFormat: videoStream.pix_fmt,
        profile: videoStream.profile,
        level: videoStream.level,
        width: videoStream.width,
        height: videoStream.height,
        fps: eval(videoStream.r_frame_rate),
        duration: metadata.format.duration,
        bitrate: metadata.format.bit_rate,
        hasAudio: !!audioStream,
        size: metadata.format.size
      });
    });
  });
}

/**
 * Check if video is already mobile-compatible
 * 
 * @param {Object} metadata - Video metadata from inspectVideo
 * @returns {boolean} - True if compatible, false otherwise
 */
export function isMobileCompatible(metadata) {
  // Check container
  if (!metadata.container.includes('mp4')) {
    return false;
  }

  // Check video codec - must be H.264
  const videoCodec = metadata.videoCodec.toLowerCase();
  if (videoCodec !== 'h264' && videoCodec !== 'avc') {
    return false;
  }

  // Check pixel format - must be yuv420p
  if (metadata.pixelFormat && metadata.pixelFormat !== 'yuv420p') {
    return false;
  }

  // Check profile - must not be High 10, High 4:2:2, or High 4:4:4
  if (metadata.profile) {
    const profile = metadata.profile.toLowerCase();
    if (profile === 'high 10' || profile === 'high 4:2:2' || profile === 'high 4:4:4') {
      return false;
    }
  }

  // Check audio codec - must be AAC if audio exists
  if (metadata.hasAudio && metadata.audioCodec) {
    const audioCodec = metadata.audioCodec.toLowerCase();
    if (audioCodec !== 'aac') {
      return false;
    }
  }

  return true;
}

/**
 * Transcode video to mobile-compatible format
 * 
 * FFmpeg Settings:
 * - Video: H.264, High profile, level 4.0 (supports up to 1080p)
 * - Audio: AAC, 192kbps
 * - Pixel format: yuv420p
 * - Preset: medium (balance between speed and quality)
 * - CRF: 23 (good quality, reasonable file size)
 * 
 * @param {string} inputPath - Path to input video
 * @param {string} outputPath - Path to output video
 * @param {Object} options - Transcoding options
 * @returns {Promise<Object>} - Transcoding result
 */
export async function transcodeVideo(inputPath, outputPath, options = {}) {
  const {
    crf = 23,
    preset = 'medium',
    audioBitrate = '192k',
    videoBitrate = null,
    onProgress = null
  } = options;

  return new Promise((resolve, reject) => {
    console.log('[Transcode] Starting transcoding:', { inputPath, outputPath, crf, preset });

    let command = ffmpeg(inputPath)
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-pix_fmt yuv420p',
        '-profile:v high',
        '-level 4.0',
        `-crf ${crf}`,
        `-preset ${preset}`,
        '-movflags +faststart', // Enable fast start for streaming
        '-strict experimental'
      ])
      .audioBitrate(audioBitrate);

    // Add video bitrate if specified
    if (videoBitrate) {
      command = command.videoBitrate(videoBitrate);
    }

    // Add progress callback
    if (onProgress) {
      command.on('progress', (progress) => {
        onProgress(progress);
      });
    }

    command.on('start', (commandLine) => {
      console.log('[Transcode] FFmpeg command:', commandLine);
    })
    .on('end', () => {
      console.log('[Transcode] Transcoding completed successfully');
      resolve({ success: true, outputPath });
    })
    .on('error', (err) => {
      console.error('[Transcode] FFmpeg error:', err.message);
      reject(new Error(`Transcoding failed: ${err.message}`));
    })
    .run();
  });
}

/**
 * Process video: inspect and transcode if needed
 * 
 * @param {string} inputPath - Path to input video
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Processing result
 */
export async function processVideo(inputPath, options = {}) {
  const { forceTranscode = false, onProgress = null } = options;

  try {
    // Inspect video
    console.log('[Process] Inspecting video:', inputPath);
    const metadata = await inspectVideo(inputPath);
    console.log('[Process] Video metadata:', metadata);

    // Check if already compatible
    const compatible = isMobileCompatible(metadata);
    console.log('[Process] Mobile compatible:', compatible);

    if (compatible && !forceTranscode) {
      console.log('[Process] Video already compatible, skipping transcoding');
      return {
        success: true,
        transcoded: false,
        outputPath: inputPath,
        metadata
      };
    }

    // Transcode to compatible format
    const outputPath = join(tmpdir(), `transcoded-${Date.now()}.mp4`);
    console.log('[Process] Transcoding to:', outputPath);

    await transcodeVideo(inputPath, outputPath, {
      onProgress,
      ...options
    });

    // Verify output
    const outputMetadata = await inspectVideo(outputPath);
    const outputCompatible = isMobileCompatible(outputMetadata);

    if (!outputCompatible) {
      throw new Error('Transcoded video is still not mobile-compatible');
    }

    return {
      success: true,
      transcoded: true,
      outputPath,
      inputMetadata: metadata,
      outputMetadata
    };

  } catch (error) {
    console.error('[Process] Processing failed:', error);
    throw error;
  }
}

/**
 * Clean up temporary files
 * 
 * @param {string} filePath - Path to file to delete
 */
export function cleanupFile(filePath) {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      console.log('[Cleanup] Deleted temporary file:', filePath);
    }
  } catch (error) {
    console.warn('[Cleanup] Failed to delete file:', filePath, error.message);
  }
}

/**
 * Process video from buffer (for upload pipeline)
 * 
 * @param {Buffer} buffer - Video file buffer
 * @param {string} originalName - Original filename
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Processing result with output path
 */
export async function processVideoFromBuffer(buffer, originalName, options = {}) {
  const fs = await import('fs');
  const path = await import('path');

  // Create temporary input file
  const inputPath = join(tmpdir(), `input-${Date.now()}-${originalName}`);
  fs.writeFileSync(inputPath, buffer);

  try {
    const result = await processVideo(inputPath, options);
    
    // Read output file if transcoded
    if (result.transcoded) {
      const outputBuffer = fs.readFileSync(result.outputPath);
      result.outputBuffer = outputBuffer;
    } else {
      result.outputBuffer = buffer;
    }

    return result;
  } finally {
    // Clean up temporary files
    cleanupFile(inputPath);
    if (result?.transcoded && result?.outputPath) {
      cleanupFile(result.outputPath);
    }
  }
}
