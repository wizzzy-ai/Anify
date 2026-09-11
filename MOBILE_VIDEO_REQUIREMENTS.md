# Mobile Video Playback Requirements

## Root Cause Analysis

Anify uses **Cloudflare R2** (not Cloudflare Stream) as simple object storage for MP4 files. The mobile playback issue is caused by **video codec incompatibility**.

### Why Some Videos Work on PC but Fail on Mobile

- **Desktop browsers** (Chrome, Edge, Firefox, Safari) support a wide range of video codecs: H.264, H.265/HEVC, VP9, AV1, etc.
- **Mobile browsers** have strict codec requirements:
  - **iOS Safari**: Requires H.264 video + AAC audio in MP4 container
  - **Android Chrome**: Requires H.264 video + AAC audio (some devices support H.265)

### Why Tokyo Revengers and One Piece Fail on Mobile

These videos were likely encoded with codecs incompatible with mobile:
- H.265/HEVC video codec
- VP9 video codec
- Non-AAC audio codec (e.g., Opus, Vorbis)
- High H.264 profiles (High 10, High 4:2:2, High 4:4:4)

Desktop browsers play them fine, but mobile browsers show the poster and play audio only because they can decode the audio stream but not the video stream.

### Why Some Older Anime Still Work

Older episodes were encoded with H.264 + AAC, which is mobile-compatible.

## Mobile Browser Codec Requirements

### iOS Safari
- **Video Codec**: H.264/AVC only
- **Audio Codec**: AAC only
- **H.264 Profile**: Baseline, Main, or High (not High 10, 4:2:2, or 4:4:4)
- **Container**: MP4

### Android Chrome
- **Video Codec**: H.264/AVC (some devices support H.265/HEVC)
- **Audio Codec**: AAC (most devices)
- **Container**: MP4

## Current Implementation

### What We've Added
1. **MP4 File Signature Validation** (`utils/videoCodecValidator.js`)
   - Validates that uploaded files are valid MP4 containers
   - Lightweight check, does not verify codecs
   - Prevents obviously invalid files from being uploaded

2. **Enhanced R2 Upload Headers** (`utils/uploadToR2.js`)
   - Added `Cache-Control: public, max-age=31536000` for better caching
   - Added metadata tracking for upload time

3. **Mobile Codec Detection** (`js/player/playerService.js`)
   - Detects codec-related playback errors on mobile
   - Shows user-friendly error messages
   - Logs detailed diagnostic information

### What We Did NOT Add
- FFmpeg-based codec validation (per your request)
- Video transcoding system
- Cloudflare Stream integration

## Limitations of Current Solution

The current implementation **does NOT** prevent videos with incompatible codecs from being uploaded. It only:
- Validates the MP4 container format
- Detects playback issues after they occur
- Provides user feedback when videos fail to play

## Recommended Complete Solution

To fully fix the mobile playback issue, you have two options:

### Option 1: Enforce H.264/AAC Encoding (Recommended)

Add FFmpeg validation to the upload pipeline to ensure all videos are encoded with mobile-compatible codecs:

1. Install FFmpeg on your server
2. Add codec validation before upload
3. Reject videos with incompatible codecs
4. Provide clear error messages to uploaders

**Pros**:
- Prevents incompatible videos from being uploaded
- Ensures all future videos work on mobile
- No ongoing transcoding costs

**Cons**:
- Requires FFmpeg installation
- Uploaders must re-encode existing videos
- Some uploaders may not have the technical knowledge

### Option 2: Use Cloudflare Stream (Alternative)

Switch from R2 to Cloudflare Stream, which automatically transcodes videos to mobile-compatible formats:

1. Upload videos to Cloudflare Stream instead of R2
2. Stream automatically provides HLS/DASH with multiple codec variants
3. Update player to use Stream's playback URLs

**Pros**:
- Automatic transcoding to all required formats
- No codec validation needed
- Better performance with adaptive bitrate streaming

**Cons**:
- Cloudflare Stream has additional costs
- Requires significant code changes
- Existing videos would need re-uploading

## Testing on Mobile

### Android Testing
1. Open Chrome on an Android device
2. Navigate to your Anify site
3. Try playing Tokyo Revengers or One Piece episodes
4. Check if video displays correctly (not just poster + audio)

### iOS Testing
1. Open Safari on an iPhone or iPad
2. Navigate to your Anify site
3. Try playing Tokyo Revengers or One Piece episodes
4. Check if video displays correctly

### Diagnostic Information

The player now logs detailed information when codec issues are detected:
- User agent
- Error message
- Video URL
- Browser type (iOS/Android)

Check the browser console for these logs when testing.

## Existing Affected Videos

Videos that are currently failing on mobile will continue to fail until they are:
1. Re-encoded with H.264 video + AAC audio
2. Re-uploaded to Anify

## Future Uploads

With the current implementation, future uploads will:
- Be validated as valid MP4 files
- Have proper caching headers
- Show clear error messages if they fail to play on mobile

However, they will still be accepted even if they have incompatible codecs. To prevent this, implement Option 1 (FFmpeg validation) or Option 2 (Cloudflare Stream).

## Summary

**Root Cause**: Video codec incompatibility - some videos use codecs that mobile browsers don't support.

**Current Fix**: Lightweight validation + error detection (partial solution).

**Complete Fix**: Either enforce H.264/AAC encoding with FFmpeg validation, or switch to Cloudflare Stream for automatic transcoding.
