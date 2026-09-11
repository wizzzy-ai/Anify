/**
 * Video Codec Validator
 * Ensures uploaded videos are compatible with mobile browsers
 * 
 * Mobile Browser Requirements:
 * - iOS Safari: H.264 video + AAC audio in MP4 container
 * - Android Chrome: H.264 video + AAC audio (some devices support H.265)
 * 
 * This validator performs lightweight file signature validation.
 * Full codec validation requires FFmpeg and should be done separately
 * if you want to enforce strict codec requirements.
 */

/**
 * Lightweight validation for production (checks file signature only)
 * This validates that the file is a valid MP4 container.
 * 
 * Note: This does NOT check video/audio codecs. For full codec validation,
 * you would need to use FFmpeg or similar tools to verify H.264/AAC.
 * 
 * @param {Object} file - Multer file object
 * @returns {Object} - Validation result
 */
export function quickValidateVideoSignature(file) {
  if (!file || !file.buffer) {
    return { valid: false, error: 'Invalid file: missing buffer' };
  }

  const buffer = file.buffer;
  
  // Check for MP4 file signature (ftyp box)
  // MP4 files start with: 00 00 00 XX 66 74 79 70 (ftyp)
  if (buffer.length < 12) {
    return { valid: false, error: 'File too small to be a valid MP4' };
  }

  // Check for ftyp box at offset 4
  const hasFtyp = buffer[4] === 0x66 && buffer[5] === 0x74 && 
                  buffer[6] === 0x79 && buffer[7] === 0x70;
  
  if (!hasFtyp) {
    return { valid: false, error: 'Invalid MP4 file signature' };
  }

  return { valid: true };
}
