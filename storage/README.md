# Anify Storage Architecture

Production-ready storage architecture for the Anify anime streaming platform.

## Overview

Anify uses a dual-storage architecture:
- **Cloudinary** for images (posters, banners, thumbnails, avatars, logos)
- **Cloudflare R2** for videos (episodes, movies, trailers, banner videos)

## Directory Structure

```
storage/
├── storageService.js       # Unified storage service interface
├── videoStorage.js          # Video storage operations (R2)
├── imageStorage.js          # Image storage operations (Cloudinary)
├── uploadToR2.js           # R2 upload implementation
├── cloudinaryUpload.js      # Cloudinary upload implementation
├── healthChecker.js         # Storage health monitoring
└── migration/
    ├── migrateVideosToR2.js           # Video migration script
    └── migrateImagesToCloudinary.js   # Image migration script
```

## Storage Providers

### Cloudinary (Images)

**Folder Structure:**
```
anify/
├── posters/
├── banners/
├── thumbnails/
├── avatars/
└── logos/
```

**Supported Operations:**
- Upload posters, banners, thumbnails, avatars, logos
- Delete images
- Replace images
- Generate optimized URLs
- Generate thumbnail URLs

### Cloudflare R2 (Videos)

**Folder Structure:**
```
videos/
├── anime/{id}/season-{season}/
├── movies/{id}/
├── trailers/{id}/
└── banners/{id}/
```

**Supported Operations:**
- Upload episodes, movies, trailers, banner videos
- Delete videos
- Replace videos
- Generate signed URLs

## Usage

### Unified Storage Service

```javascript
import { uploadFile, uploadVideo, uploadImage, uploadPoster, uploadBanner } from './storage/storageService.js';

// Upload any file (auto-detects type)
const result = await uploadFile(file, {
  type: 'video',
  subtype: 'episode',
  id: animeId,
  metadata: { season: 1, episode: 1, quality: '1080p' }
});

// Upload video specifically
const videoResult = await uploadVideo(file, {
  type: 'anime',
  id: animeId,
  metadata: { season: 1, episode: 1 }
});

// Upload image specifically
const imageResult = await uploadImage(file, {
  imageType: 'poster',
  id: animeId
});

// Upload poster
const posterResult = await uploadPoster(file, { animeId });

// Upload banner
const bannerResult = await uploadBanner(file, { animeId });
```

### Video Storage Service

```javascript
import { uploadEpisode, uploadMovie, uploadTrailer, deleteVideo, getSignedVideoUrl } from './storage/videoStorage.js';

// Upload episode
const episode = await uploadEpisode(file, {
  animeId: '123',
  season: 1,
  episode: 1,
  quality: '1080p',
  language: 'sub'
});

// Upload movie
const movie = await uploadMovie(file, {
  movieId: '456',
  quality: '1080p'
});

// Upload trailer
const trailer = await uploadTrailer(file, { animeId: '123' });

// Delete video
await deleteVideo('videos/anime/123/season-1/timestamp-random-filename.mp4');

// Get signed URL
const signedUrl = await getSignedVideoUrl('videos/anime/123/season-1/filename.mp4', 3600);
```

### Image Storage Service

```javascript
import { uploadPoster, uploadBanner, uploadThumbnail, uploadAvatar, deleteImage, getOptimizedImageUrl } from './storage/imageStorage.js';

// Upload poster
const poster = await uploadPoster(file, { animeId: '123' });

// Upload banner
const banner = await uploadBanner(file, { animeId: '123' });

// Upload thumbnail
const thumbnail = await uploadThumbnail(file, {
  animeId: '123',
  episode: 1
});

// Upload avatar
const avatar = await uploadAvatar(file, { userId: '456' });

// Delete image
await deleteImage('anify/posters/123/timestamp-random-filename');

// Get optimized URL
const optimizedUrl = getOptimizedImageUrl('anify/posters/123/filename', {
  width: 400,
  height: 600,
  quality: 'auto'
});
```

## Migration

### Migrate Videos to R2

```bash
node storage/migration/migrateVideosToR2.js
```

**Features:**
- Scans MongoDB for local video references
- Uploads to R2 with proper folder structure
- Updates MongoDB with new URLs and metadata
- Skips already migrated files
- Resume capability if interrupted
- Progress tracking and logging
- Does NOT delete local files

### Migrate Images to Cloudinary

```bash
node storage/migration/migrateImagesToCloudinary.js
```

**Features:**
- Scans MongoDB for local image references
- Uploads to Cloudinary with proper folder structure
- Updates MongoDB with new URLs and metadata
- Skips already migrated files
- Resume capability if interrupted
- Progress tracking and logging
- Does NOT delete local files

## Health Monitoring

### API Endpoint

```bash
GET /api/admin/storage/health
```

**Response:**
```json
{
  "ok": true,
  "health": {
    "totalVideos": 1500,
    "totalImages": 3200,
    "r2StorageUsed": "45.2 GB",
    "cloudinaryStorageUsed": "12.8 GB",
    "missingFiles": 0,
    "orphanedFiles": 0,
    "failedUploads": 0,
    "storageProviders": {
      "r2": 1500,
      "cloudinary": 3200,
      "local": 0
    }
  }
}
```

### Programmatic Usage

```javascript
import { getStorageHealth, getStorageHealthForDashboard } from './storage/healthChecker.js';

// Full health report
const fullHealth = await getStorageHealth();
console.log(fullHealth);

// Dashboard summary
const dashboardHealth = await getStorageHealthForDashboard();
console.log(dashboardHealth);
```

## Database Schema

### Video Metadata

```javascript
{
  storageProvider: 'r2',
  storageKey: 'videos/anime/123/season-1/timestamp-random-filename.mp4',
  fileSize: 178310200,
  mimeType: 'video/mp4',
  uploadedAt: '2026-07-30T02:00:00.000Z'
}
```

### Image Metadata

```javascript
{
  storageProvider: 'cloudinary',
  publicId: 'anify/posters/123/timestamp-random-filename',
  width: 400,
  height: 600,
  format: 'jpg',
  bytes: 524288,
  uploadedAt: '2026-07-30T02:00:00.000Z'
}
```

## Environment Variables

Required environment variables in `.env`:

```env
# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=anify-media
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Best Practices

1. **Always use the storage service** - Never upload files directly to local storage
2. **Use appropriate folder structures** - Follow the defined folder conventions
3. **Handle errors properly** - All storage operations can fail, implement retry logic
4. **Monitor storage usage** - Use the health checker to track storage consumption
5. **Clean up orphaned files** - Regularly check for files in storage that aren't referenced in the database
6. **Use signed URLs for private content** - For sensitive content, use signed URLs with expiration
7. **Optimize images** - Use Cloudinary's optimization features for better performance
8. **Use multipart uploads for large videos** - Videos > 100MB are automatically uploaded using multipart

## Error Handling

All storage operations throw errors with descriptive messages:

```javascript
try {
  const result = await uploadFile(file, options);
} catch (error) {
  if (error.code === 'INVALID_FILE') {
    // Handle invalid file
  } else if (error.code === 'UPLOAD_TIMEOUT') {
    // Handle timeout
  } else if (error.code === 'NETWORK_ERROR') {
    // Handle network error
  }
}
```

## Backward Compatibility

The old upload endpoints in `server.js` are maintained for backward compatibility:
- `/api/upload` - Generic upload endpoint
- `/api/storage/upload` - New storage-aware endpoint
- `/api/storage/upload/poster` - Poster upload
- `/api/storage/upload/banner` - Banner upload
- `/api/storage/upload/avatar` - Avatar upload
- `/api/storage/upload/video` - Video upload

## Support

For issues or questions about the storage architecture, refer to:
- Cloudinary documentation: https://cloudinary.com/documentation
- Cloudflare R2 documentation: https://developers.cloudflare.com/r2/
