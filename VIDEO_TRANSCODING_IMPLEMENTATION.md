# Video Transcoding Implementation - Mobile Compatibility Fix

## Overview

This implementation ensures all videos uploaded to Anify are mobile-compatible by automatically transcoding incompatible videos to H.264 + AAC + yuv420p MP4 format.

## Files Changed

### 1. `utils/videoTranscoder.js` (NEW FILE)
**Purpose**: Core video transcoding service with codec inspection

**Functions**:
- `inspectVideo(inputPath)` - Inspects video codec information using ffprobe
- `isMobileCompatible(metadata)` - Checks if video meets mobile requirements
- `transcodeVideo(inputPath, outputPath, options)` - Transcodes to mobile-compatible format
- `processVideo(inputPath, options)` - Main processing function (inspect + transcode if needed)
- `processVideoFromBuffer(buffer, originalName, options)` - Processes video from buffer (for uploads)
- `cleanupFile(filePath)` - Cleans up temporary files

**FFmpeg Settings Used**:
```bash
ffmpeg -i input.mp4 \
  -c:v libx264 \
  -profile:v high \
  -level 4.0 \
  -pix_fmt yuv420p \
  -crf 23 \
  -preset medium \
  -c:a aac \
  -b:a 192k \
  -movflags +faststart \
  output.mp4
```

**Why These Settings**:
- `libx264`: H.264 codec (universal mobile support)
- `profile:v high`: High profile (good quality, mobile-compatible)
- `level 4.0`: Supports up to 1080p (covers most anime)
- `pix_fmt yuv420p`: Required for mobile compatibility
- `crf 23`: Good quality-to-size ratio (23 is standard)
- `preset medium`: Balance between speed and quality
- `aac`: Universal audio codec for mobile
- `192k`: Good audio quality without excessive size
- `+faststart`: Enables streaming (video starts playing before fully downloaded)

### 2. `server.js` (MODIFIED)
**Changes**: Integrated transcoding into the existing upload pipeline

**Location**: Lines 907-955 in the `sendUploadedFile` function

**What It Does**:
1. When a video is uploaded via `/api/upload-video`
2. Calls `processVideoFromBuffer` to inspect the video
3. If video is incompatible, transcodes it automatically
4. If transcoding fails, returns error to admin (does not upload broken video)
5. Uploads the processed (compatible) video to R2
6. Returns transcoding status in response

**Error Handling**:
- If FFmpeg fails, returns 500 error with `TRANSCODE_FAILED` code
- Admin sees clear error message with troubleshooting guidance
- Original incompatible video is NOT uploaded

### 3. `models/Anime.js` (MODIFIED)
**Changes**: Added processing status tracking to `episodeVideoMetadataSchema`

**New Fields**:
- `processingStatus`: 'pending' | 'processing' | 'completed' | 'failed'
- `transcoded`: Boolean - whether video was transcoded
- `codecInfo`: Object with video/audio codec details
- `processingError`: String - error message if processing failed

**Purpose**: Track video processing state for admin panel display

### 4. `scripts/migrateVideosForMobile.js` (MODIFIED)
**Changes**: Updated to use the new `videoTranscoder.js` service

**What It Does**:
- Scans all anime episodes and movies in database
- Downloads videos from R2
- Inspects each video for mobile compatibility
- Only transcodes incompatible videos
- Uploads transcoded version to `/videos/mobile-migrated/` folder
- Updates database with new URL
- Keeps original as backup (does not delete)

**Usage**:
```bash
# Dry run (scan only, no changes)
node scripts/migrateVideosForMobile.js

# Execute migration
node scripts/migrateVideosForMobile.js --execute

# Limit to specific number of videos
node scripts/migrateVideosForMobile.js --execute --limit 10

# Set concurrency (default: 3)
node scripts/migrateVideosForMobile.js --execute --concurrency 2
```

### 5. `package.json` (MODIFIED)
**Changes**: Added `fluent-ffmpeg` dependency

## How Future Uploads Are Processed

```
ADMIN UPLOADS VIDEO
↓
Server receives video via /api/upload-video
↓
processVideoFromBuffer() inspects video codec
↓
Is video mobile-compatible?
├─ YES → Skip transcoding, use original
└─ NO  → Transcode to H.264 + AAC + yuv420p
↓
Upload final MP4 to Cloudflare R2
↓
Return URL to admin
↓
Admin saves URL to episode
↓
Episode available to users
↓
Works on PC + Android + iPhone
```

## How Existing Videos Are Migrated

```
RUN MIGRATION SCRIPT
↓
Scan all anime in database
↓
For each video:
├─ Download from R2
├─ Inspect codec
├─ If compatible → Skip
└─ If incompatible → Transcode
↓
Upload transcoded version to /videos/mobile-migrated/
↓
Update database with new URL
↓
Keep original as backup
↓
Verify transcoded video works
↓
Done
```

## How The System Prevents Incompatible Videos

1. **Upload Pipeline**: Every new video is inspected before upload
2. **Automatic Transcoding**: Incompatible videos are transcoded automatically
3. **Error Handling**: If transcoding fails, upload is rejected with clear error
4. **Database Tracking**: Processing status is stored for each video
5. **Migration Utility**: Existing videos can be batch-migrated

## Target Format Specifications

- **Container**: MP4
- **Video Codec**: H.264/AVC (libx264)
- **Audio Codec**: AAC
- **Pixel Format**: yuv420p
- **Profile**: High
- **Level**: 4.0 (supports up to 1080p)
- **CRF**: 23 (quality setting)
- **Preset**: medium (speed/quality balance)
- **Audio Bitrate**: 192k
- **Streaming**: +faststart enabled

## Mobile Browser Compatibility

### iOS Safari
- ✅ H.264 video
- ✅ AAC audio
- ✅ yuv420p pixel format
- ✅ MP4 container

### Android Chrome
- ✅ H.264 video
- ✅ AAC audio
- ✅ yuv420p pixel format
- ✅ MP4 container

### Desktop Browsers
- ✅ Chrome
- ✅ Edge
- ✅ Firefox
- ✅ Safari

## Testing Instructions

### Test 1: Compatible Video (Should Skip Transcoding)
1. Upload a video already encoded with H.264 + AAC
2. Check server logs for "Video already mobile-compatible, skipping transcoding"
3. Verify video plays on all platforms
4. Verify `transcoded: false` in response

### Test 2: Incompatible Video (Should Transcode)
1. Upload a video with H.265 or non-AAC audio
2. Check server logs for transcoding progress
3. Verify video plays on all platforms
4. Verify `transcoded: true` in response

### Test 3: Migration for Tokyo Revengers
```bash
# First, dry run to see what needs migration
node scripts/migrateVideosForMobile.js

# Then execute
node scripts/migrateVideosForMobile.js --execute --limit 50
```

### Test 4: Migration for One Piece
```bash
# Same as above, script will process all anime including One Piece
node scripts/migrateVideosForMobile.js --execute --limit 100
```

### Test 5: Mobile Playback Verification
1. Open Anify on Android Chrome
2. Play Tokyo Revengers episode
3. Verify video displays (not just poster + audio)
4. Test seeking, fullscreen, audio
5. Repeat on iPhone Safari
6. Repeat on desktop browsers

## Error Handling

### If FFmpeg Fails During Upload
- Server returns 500 error with `TRANSCODE_FAILED` code
- Error message: "Video processing failed: [error]. Please ensure the video is a valid MP4 file or try re-encoding it with H.264/AAC."
- Admin can retry with a different file
- Original incompatible video is NOT uploaded

### If FFmpeg Fails During Migration
- Script logs the error
- Continues to next video
- Original video remains unchanged
- Admin can retry specific videos manually

## Performance Considerations

- **Temporary Files**: Stored in OS temp directory, cleaned up after processing
- **Memory**: Uses streams for large files, does not load entire video into memory
- **Concurrency**: Migration script supports concurrent processing (default: 3)
- **Timeout**: Upload timeout extended to 15 minutes for large files (>100MB)

## Security

- FFmpeg runs server-side only
- No R2 credentials exposed to frontend
- Temporary files are cleaned up
- File paths are validated for security

## Dependencies

- `fluent-ffmpeg`: Node.js wrapper for FFmpeg
- FFmpeg must be installed on the server (system requirement)

## Installing FFmpeg

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

### macOS
```bash
brew install ffmpeg
```

### Windows
```bash
winget install Gyan.FFmpeg
```

Or download from: https://ffmpeg.org/download.html

## Verification Checklist

After implementation, verify:

- [ ] FFmpeg is installed on server
- [ ] `fluent-ffmpeg` package is installed
- [ ] Upload pipeline works with compatible videos
- [ ] Upload pipeline works with incompatible videos
- [ ] Transcoded videos play on Android Chrome
- [ ] Transcoded videos play on iPhone Safari
- [ ] Transcoded videos play on desktop browsers
- [ ] Migration script runs without errors
- [ ] Tokyo Revengers episodes are migrated
- [ ] One Piece episodes are migrated
- [ ] Existing functionality is unaffected
- [ ] Admin panel still works
- [ ] Video player still works
- [ ] Seeking works
- [ ] Fullscreen works
- [ ] Poster still displays

## Rollback Plan

If issues occur:

1. **Upload Pipeline**: Revert `server.js` changes to disable transcoding
2. **Migration**: Original videos are kept as backup, can revert URLs
3. **Database**: New schema fields are optional, backward compatible

## Summary

This implementation provides a production-ready video compatibility pipeline that:
- Automatically ensures all videos are mobile-compatible
- Only transcodes when necessary (preserves quality, saves time)
- Provides clear error handling and logging
- Includes a safe migration utility for existing videos
- Integrates seamlessly with existing Anify architecture
- Does not require Cloudflare Stream migration
- Works on all target platforms (Android, iOS, Desktop)
