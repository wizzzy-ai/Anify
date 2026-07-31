import dotenv from "dotenv";
dotenv.config();

import dns from "node:dns";

// Force Node.js to use Cloudflare DNS
dns.setServers(["1.1.1.1", "1.0.0.1"]);
import express from 'express';
import multer from 'multer';
import cloudinary from "./config/cloudinary.js";
import { uploadToCloudinary, uploadVideo } from "./utils/cloudinaryUpload.js";
import { uploadToR2 } from "./utils/uploadToR2.js";
import { uploadFile as storageUploadFile } from "./storage/storageService.js";
import { getStorageHealthForDashboard } from "./storage/healthChecker.js";
import streamifier from "streamifier";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from './User.js'; // Import the centralized User model
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    dbReady: dbReady,
    timestamp: new Date().toISOString()
  });
});

// Verification page route
app.get('/verify-email.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'verify-email.html'));
});

// Banned page route
app.get('/account-banned', (req, res) => {
  res.sendFile(path.join(__dirname, 'account-banned.html'));
});

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const hasMongo = Boolean(process.env.MONGODB_URI);

let dbReady = false;
if (hasMongo) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      dbReady = true;
      console.log('MongoDB connected');
      console.log('MongoDB database name:', mongoose.connection.name);
      console.log('Database:', mongoose.connection.name);
      console.log('Host:', mongoose.connection.host);
      console.log('Ready:', mongoose.connection.readyState);
      console.log('MongoDB host:', mongoose.connection.host);
    })
    .catch((error) => {
      console.warn('MongoDB connection failed:', error.message);
    });
}

const episodeSourceSchema = new mongoose.Schema({
  // qualities: { '1080p': url, '720p': url, ... }
  qualities: { type: Map, of: String, default: {} },
}, { _id: false });

const videoMetadataSchema = new mongoose.Schema({
  storageProvider: { type: String, enum: ['r2', 'cloudinary'], default: 'r2' },
  storageKey: String, // R2 object key
  publicId: String, // Cloudinary public_id
  fileSize: Number, // File size in bytes
  duration: Number, // Video duration in seconds
  resolution: String, // e.g., "1920x1080"
  mimeType: String, // e.g., "video/mp4"
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const imageMetadataSchema = new mongoose.Schema({
  storageProvider: { type: String, enum: ['cloudinary'], default: 'cloudinary' },
  publicId: String, // Cloudinary public_id
  width: Number,
  height: Number,
  format: String, // e.g., "jpg", "png"
  bytes: Number,
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const episodeSchema = new mongoose.Schema({
  episodeNumber: { type: Number, required: true, index: true },

  // Optional episode metadata for admin episode management UI
  episodeTitle: { type: String, default: '' },
  thumbnail: { type: String, default: '' },
  thumbnailMetadata: { type: imageMetadataSchema, default: null },

  introStart: { type: Number, default: 0 },
  introEnd: { type: Number, default: 90 },
  outroStart: { type: Number, default: 0 },
  outroEnd: { type: Number, default: 0 },

  sub: { type: episodeSourceSchema, default: () => ({ qualities: {} }) },
  dub: { type: episodeSourceSchema, default: () => ({ qualities: {} }) },
}, { timestamps: true, _id: false });

const animeSchema = new mongoose.Schema({
  clientId: { type: Number, index: true },

  // Content type: keeps existing anime behavior but enables Movies.
  //  - 'anime' (default): current show/series model
  //  - 'animated-movie': animated movies
  //  - 'live-movie': real-life/live-action movies
  type: { type: String, enum: ['anime', 'animated-movie', 'live-movie'], default: 'anime', index: true },

  title: { type: String, required: true },
  titleJp: String,
  rating: { type: Number, default: 0 },
  year: Number,

  // kept as a numeric hint/display value
  episodes: { type: Number, default: 1 },

  genres: [String],
  status: { type: String, default: 'Airing' },
  studio: String,
  image: String,
  imageMetadata: { type: imageMetadataSchema, default: null },
  banner: String,
  bannerMetadata: { type: imageMetadataSchema, default: null },
  bannerVideo: String,
  bannerVideoMetadata: { type: videoMetadataSchema, default: null },
  bannerDisplay: { type: String, default: 'image' },
  desc: String,
  featured: Boolean,
  trending: Boolean,
  premium: Boolean,
  newEpisode: Boolean,
  trailer: String,
  trailerMetadata: { type: videoMetadataSchema, default: null },

  introStart: { type: Number, default: 0 },
  introEnd: { type: Number, default: 90 },
  outroStart: { type: Number, default: 0 },
  outroEnd: { type: Number, default: 0 },

  // Per-episode sources (fixes ep2 overwriting ep1) - used for anime only
  episodesMedia: { type: [episodeSchema], default: [] },

  // Movie sources (single player). For movies we use these fields.
  movieMedia: {
    // qualities: { '1080p': url, '720p': url }
    qualities: { type: Map, of: String, default: {} },
    metadata: { type: videoMetadataSchema, default: null },
  },

  // Backwards compatible fields (existing data may use them)
  videoUrl: String,
  videoSources: {
    sub: { type: Map, of: String, default: {} },
    dub: { type: Map, of: String, default: {} },
  },
}, { timestamps: true });

const watchProgressSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  animeId: { type: String, index: true },
  episode: { type: Number, default: 1 },
  language: { type: String, default: 'sub' },
  quality: { type: String, default: '1080p' },
  time: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
}, { timestamps: true });

const commentSchema = new mongoose.Schema({
  animeId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  text: { type: String, required: true, trim: true },
  likes: { type: Number, default: 0 },
}, { timestamps: true });

const genreSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true, index: true },
  slug: { type: String, required: true, trim: true, unique: true, index: true },
  description: { type: String, default: '' },
  animeCount: { type: Number, default: 0 },
}, { timestamps: true });

const Anime = mongoose.models.Anime || mongoose.model('Anime', animeSchema);
const WatchProgress = mongoose.models.WatchProgress || mongoose.model('WatchProgress', watchProgressSchema);
const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
const Genre = mongoose.models.Genre || mongoose.model('Genre', genreSchema);


const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1 GB
  },
});

function makeSafeFilename(originalName) {
  const ext = path.extname(originalName);
  const safeBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${safeBase}-${unique}${ext}`;
}

function normalizeAnime(anime) {
  if (!anime) return anime;
  const obj = typeof anime.toObject === 'function' ? anime.toObject() : anime;

  const episodesMedia = Array.isArray(obj.episodesMedia)
    ? obj.episodesMedia.map(e => ({
        episodeNumber: e.episodeNumber,
        sub: {
          qualities:
            e?.sub?.qualities instanceof Map ? Object.fromEntries(e.sub.qualities) : (e?.sub?.qualities || {}),
        },
        dub: {
          qualities:
            e?.dub?.qualities instanceof Map ? Object.fromEntries(e.dub.qualities) : (e?.dub?.qualities || {}),
        },
      }))
    : [];

  // If episodesMedia exists but episodes hint is stale (common after switching
  // between views / filters), recompute a safer episodes count.
  const episodesFromMedia = episodesMedia.length
    ? Math.max(1, ...episodesMedia
      .map(e => Number(e?.episodeNumber))
      .filter(n => Number.isFinite(n) && n >= 1))
    : null;


  // Normalize movieMedia.qualities Map -> plain object (fixes movie playback/UI inconsistencies)
  const movieQualities = obj?.movieMedia?.qualities instanceof Map
    ? Object.fromEntries(obj.movieMedia.qualities)
    : (obj?.movieMedia?.qualities || {});

  // Ensure episode hint is in sync with actual episodesMedia.
  const episodesHint = episodesFromMedia || (obj.episodes != null ? obj.episodes : undefined);

  return {
    ...obj,
    id: obj.clientId || obj.id || obj._id?.toString(),

    // keep existing normalization for backwards compat
    videoSources: {
      sub: obj.videoSources?.sub instanceof Map ? Object.fromEntries(obj.videoSources.sub) : (obj.videoSources?.sub || {}),
      dub: obj.videoSources?.dub instanceof Map ? Object.fromEntries(obj.videoSources.dub) : (obj.videoSources?.dub || {}),
    },

    // new per-episode payload
    episodesMedia,

    // sync episode hint
    episodes: episodesHint,

    // normalized movie payload
    movieMedia: {
      ...(obj.movieMedia || {}),
      qualities: movieQualities,
    },
  };
}


function requireDb(req, res, next) {
  if (!dbReady) {
    return res.status(503).json({
      ok: false,
      error: 'MongoDB is not connected. Add MONGODB_URI to .env and restart the server.',
    });
  }
  next();
}

const defaultGenreNames = [
  'Action','Adventure','Comedy','Drama','Fantasy','Sci-Fi','Romance','Slice of Life','Mystery','Thriller','Horror','Supernatural','Psychological','Sports','Music','Mecha','Military','Historical','Samurai','Martial Arts','Magic','Isekai','School','Shounen','Shoujo','Seinen','Josei','Ecchi','Harem','Reverse Harem','Idol','Cooking','Medical','Detective','Crime','Police','Spy','Family','Vampire','Demons','Monsters','Space','Survival','Game','Parody','Post-Apocalyptic','Superpower'
];

function normalizeGenreList(genres) {
  return [...new Set((Array.isArray(genres) ? genres : [])
    .map((genre) => String(genre || '').trim())
    .filter(Boolean))];
}

async function seedDefaultGenres() {
  if (!dbReady) return [];
  for (const name of defaultGenreNames) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await Genre.updateOne(
      { slug },
      { $setOnInsert: { name, slug, description: '', animeCount: 0 } },
      { upsert: true }
    );
  }
  return Genre.find().sort({ name: 1 }).lean();
}

async function syncGenreCounts() {
  if (!dbReady) return [];
  await seedDefaultGenres();
  const genres = await Genre.find().lean();
  const counts = await Anime.aggregate([
    { $unwind: { path: '$genres', preserveNullAndEmptyArrays: false } },
    { $group: { _id: '$genres', count: { $sum: 1 } } },
  ]);

  const countMap = Object.fromEntries(counts.map((entry) => [String(entry._id), entry.count]));
  for (const genre of genres) {
    await Genre.updateOne({ _id: genre._id }, { $set: { animeCount: Number(countMap[genre.name] || 0) } });
  }
  return Genre.find().sort({ name: 1 }).lean();
}

// For GET endpoints where the frontend should continue using local data,
// we must not return a successful JSON shape that overwrites the UI.
function requireDbForGet(okPayload, res) {
  if (dbReady) return true;
  res.json(okPayload);
  return false;
}

/**
 * Get appropriate HTTP status code for upload errors
 */
function getErrorStatusCode(error) {
  const code = error.code || '';
  
  switch (code) {
    case 'INVALID_FILE':
    case 'INVALID_FILE_SIZE':
    case 'INVALID_FILE_TYPE':
    case 'BAD_REQUEST':
      return 400;
    case 'AUTH_ERROR':
      return 401;
    case 'FILE_TOO_LARGE':
    case 'UNSUPPORTED_TYPE':
      return 413;
    case 'NETWORK_ERROR':
    case 'UPLOAD_TIMEOUT':
      return 504;
    case 'BUCKET_NOT_FOUND':
      return 404;
    default:
      return 500;
  }
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error) {
  const code = error.code || '';
  
  // Return the custom error message if available
  if (error.message && !error.message.includes('Failed to upload')) {
    return error.message;
  }
  
  // Fallback messages based on error code
  const messages = {
    'INVALID_FILE': 'Invalid file provided',
    'INVALID_FILE_SIZE': 'File size is invalid',
    'INVALID_FILE_TYPE': 'File type is not supported',
    'FILE_TOO_LARGE': 'File is too large',
    'AUTH_ERROR': 'Authentication failed',
    'NETWORK_ERROR': 'Network error occurred',
    'UPLOAD_TIMEOUT': 'Upload timed out',
    'BUCKET_NOT_FOUND': 'Storage bucket not found',
    'UPLOAD_FAILED': 'Upload failed',
    'STREAM_ERROR': 'Stream error occurred',
  };
  
  return messages[code] || 'An error occurred during upload';
}



async function sendUploadedFile(req, res, fieldName) {
  console.log('[UPLOAD] 📁 File received:', { fieldName, filename: req.file?.originalname, mimetype: req.file?.mimetype, size: req.file?.size });
  
  try {
    if (!req.file) {
      console.error('[UPLOAD] ❌ No file received');
      return res.status(400).json({
        ok: false,
        error: `No file received. Field name must be "${fieldName}".`
      });
    }

    const isVideo = req.file.mimetype.startsWith("video");
    console.log('[UPLOAD] File type detected:', isVideo ? 'video' : 'image');

    let result;

    // Use storage layer for uploads
    if (!isVideo) {
      console.log('[UPLOAD] ☁️ Uploading to Cloudinary...');
      result = await uploadToCloudinary(
        req.file,
        "anify/posters",
        "image"
      );
      console.log('[UPLOAD] ✅ Cloudinary upload SUCCESS:', { url: result.url, public_id: result.public_id });
    } else {
      console.log('[UPLOAD] ☁️ Uploading video to Cloudinary...');
      const { videoType = 'banner', metadata = {} } = req.body || {};
      const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      
      const isBannerVideo = fieldName !== 'video'
        && ['banner', 'banner-video', 'bannerVideo'].includes(String(videoType));
      if (isBannerVideo) {
        result = await uploadVideo(req.file, 'banner', parsedMetadata);
      } else {
        result = await uploadToR2(req.file, 'videos', { metadata: parsedMetadata });
      }
      console.log('[UPLOAD] ✅ Cloudinary video upload SUCCESS:', { url: result.url, public_id: result.public_id, videoType });
    }

    console.log('[UPLOAD] 📤 Sending success response to client');
    return res.json({
      ok: true,
      url: result.url || result.secure_url,
      storage: result.storage || "cloudinary",
      public_id: result.public_id || null,
      filename: result.filename || null,
      key: result.key || null,
      size: result.size || result.bytes || null,
      mimeType: result.mimeType || null,
      duration: result.duration || null,
      videoType: result.videoType || null
    });

  } catch (e) {
    console.error("[UPLOAD] ❌ Backend upload FAILED:", e);

    return res.status(500).json({
      ok: false,
      error: e.message
    });
  }
}

// New storage-aware upload endpoints
app.post('/api/storage/upload', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: 'No file received'
      });
    }

    const { type, imageType, metadata } = req.body || {};

    const result = await storageUploadFile(req.file, {
      type,
      imageType,
      metadata: metadata ? JSON.parse(metadata) : {}
    });

    res.json({
      ok: true,
      ...result
    });

  } catch (e) {
    console.error("Storage Upload Error:", e);
    
    // Handle specific error codes
    const statusCode = getErrorStatusCode(e);
    const errorMessage = getErrorMessage(e);
    
    res.status(statusCode).json({
      ok: false,
      error: errorMessage,
      code: e.code || 'UPLOAD_ERROR'
    });
  }
});

app.post('/api/storage/upload/poster', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file received' });
    }

    const { animeId } = req.body;
    if (!animeId) {
      return res.status(400).json({ ok: false, error: 'animeId is required' });
    }

    const result = await storageUploadFile(req.file, {
      imageType: 'poster',
      metadata: { animeId }
    });

    res.json({ ok: true, ...result });

  } catch (e) {
    console.error("Poster Upload Error:", e);
    const statusCode = getErrorStatusCode(e);
    const errorMessage = getErrorMessage(e);
    res.status(statusCode).json({ ok: false, error: errorMessage, code: e.code || 'UPLOAD_ERROR' });
  }
});

app.post('/api/storage/upload/banner', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file received' });
    }

    const { animeId } = req.body;
    if (!animeId) {
      return res.status(400).json({ ok: false, error: 'animeId is required' });
    }

    const result = await storageUploadFile(req.file, {
      imageType: 'banner',
      metadata: { animeId }
    });

    res.json({ ok: true, ...result });

  } catch (e) {
    console.error("Banner Upload Error:", e);
    const statusCode = getErrorStatusCode(e);
    const errorMessage = getErrorMessage(e);
    res.status(statusCode).json({ ok: false, error: errorMessage, code: e.code || 'UPLOAD_ERROR' });
  }
});

app.post('/api/storage/upload/avatar', requireActiveUser, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file received' });
    }

    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User not authenticated' });
    }

    const result = await storageUploadFile(req.file, {
      imageType: 'avatar',
      metadata: { userId }
    });

    res.json({ ok: true, ...result });

  } catch (e) {
    console.error("Avatar Upload Error:", e);
    const statusCode = getErrorStatusCode(e);
    const errorMessage = getErrorMessage(e);
    res.status(statusCode).json({ ok: false, error: errorMessage, code: e.code || 'UPLOAD_ERROR' });
  }
});

app.post('/api/storage/upload/video', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file received' });
    }

    const { type, id, season, episode, quality } = req.body;

    const result = await storageUploadFile(req.file, {
      type: type || 'anime',
      id,
      season: season ? parseInt(season) : 1,
      episode: episode ? parseInt(episode) : 1,
      quality: quality || '1080p'
    });

    res.json({ ok: true, ...result });

  } catch (e) {
    console.error("Video Upload Error:", e);
    const statusCode = getErrorStatusCode(e);
    const errorMessage = getErrorMessage(e);
    res.status(statusCode).json({ ok: false, error: errorMessage, code: e.code || 'UPLOAD_ERROR' });
  }
});
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mongo: dbReady,
    storage: "cloudinary",
  });
});

app.get('/api/admin/storage/health', requireDb, requireAdmin, async (req, res) => {
  try {
    const health = await getStorageHealthForDashboard();
    res.json({ ok: true, health });
  } catch (error) {
    console.error('Storage health check failed:', error);
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

app.get('/api/anime', async (req, res) => {
  if (!requireDbForGet({ ok: false, error: 'MongoDB is not connected.' }, res)) return;
  const anime = await Anime.find().sort({ createdAt: -1 }).lean();
  res.json({ ok: true, anime: anime.map(normalizeAnime) });
});

app.get('/api/genres', requireDb, async (req, res) => {
  try {
    const genres = await syncGenreCounts();
    res.json({ ok: true, genres });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

app.post('/api/genres', requireDb, requireAdmin, async (req, res) => {
  try {
    const { name, description = '' } = req.body || {};
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return res.status(400).json({ ok: false, error: 'Genre name is required.' });

    const slug = normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const existing = await Genre.findOne({ $or: [{ name: normalizedName }, { slug }] });
    if (existing) return res.status(409).json({ ok: false, error: 'Genre already exists.' });

    const genre = await Genre.create({ name: normalizedName, slug, description, animeCount: 0 });
    res.status(201).json({ ok: true, genre });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

app.put('/api/genres/:id', requireDb, requireAdmin, async (req, res) => {
  try {
    const genre = await Genre.findById(req.params.id);
    if (!genre) return res.status(404).json({ ok: false, error: 'Genre not found.' });
    if (req.body?.name) genre.name = String(req.body.name).trim();
    if (req.body?.description !== undefined) genre.description = String(req.body.description || '');
    genre.slug = genre.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await genre.save();
    const fresh = await syncGenreCounts();
    res.json({ ok: true, genre: fresh.find((item) => String(item._id) === String(genre._id)) || genre });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

app.delete('/api/genres/:id', requireDb, requireAdmin, async (req, res) => {
  try {
    const deleted = await Genre.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Genre not found.' });
    await syncGenreCounts();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

app.post('/api/anime', requireDb, requireActiveUser, async (req, res) => {
  const nextClientId = req.body.clientId || Date.now();
  const anime = await Anime.create({
    ...req.body,
    clientId: nextClientId,
    genres: normalizeGenreList(req.body.genres),
  });
  await syncGenreCounts();
  res.status(201).json({ ok: true, anime: normalizeAnime(anime) });
});

// Upsert per-episode media (fixes ep2 overwriting ep1)
app.put('/api/anime/:id/episodes/:episodeNumber', requireDb, requireActiveUser, async (req, res) => {
  console.log('[MongoDB Update] Starting episode update...', { id: req.params.id, episodeNumber: req.params.episodeNumber });

  const query = /^\d+$/.test(req.params.id)
    ? { clientId: Number(req.params.id) }
    : { _id: req.params.id };

  const episodeNumber = Number(req.params.episodeNumber);
  if (!Number.isFinite(episodeNumber) || episodeNumber < 1) {
    console.error('[MongoDB Update] Invalid episode number:', episodeNumber);
    return res.status(400).json({ ok: false, error: 'episodeNumber must be >= 1' });
  }

  const update = req.body || {};
  const subQualities = update?.sub?.qualities || {};
  const dubQualities = update?.dub?.qualities || {};

  const episodeTitle = update?.episodeTitle ?? '';
  const thumbnail = update?.thumbnail ?? '';
  const introStart = Number.isFinite(Number(update?.introStart)) ? Number(update?.introStart) : undefined;
  const introEnd = Number.isFinite(Number(update?.introEnd)) ? Number(update?.introEnd) : undefined;
  const outroStart = Number.isFinite(Number(update?.outroStart)) ? Number(update?.outroStart) : undefined;
  const outroEnd = Number.isFinite(Number(update?.outroEnd)) ? Number(update?.outroEnd) : undefined;

  // Extract video metadata from qualities
  const videoMetadata = {};
  Object.entries(subQualities).forEach(([quality, url]) => {
    if (url && typeof url === 'string') {
      // Validate URL is public R2 URL, not S3 endpoint
      if (url.includes('r2.cloudflarestorage.com')) {
        console.error('[MongoDB Update] ❌ ERROR: S3 endpoint detected in URL, rejecting:', url);
        throw new Error('Invalid URL: S3 endpoint cannot be used for playback');
      }
      videoMetadata[quality] = {
        url,
        key: update?.sub?.keys?.[quality] || null,
        storageProvider: update?.sub?.storageProvider || 'r2',
        size: update?.sub?.sizes?.[quality] || null,
        mimeType: update?.sub?.mimeTypes?.[quality] || null,
      };
    }
  });
  Object.entries(dubQualities).forEach(([quality, url]) => {
    if (url && typeof url === 'string') {
      // Validate URL is public R2 URL, not S3 endpoint
      if (url.includes('r2.cloudflarestorage.com')) {
        console.error('[MongoDB Update] ❌ ERROR: S3 endpoint detected in URL, rejecting:', url);
        throw new Error('Invalid URL: S3 endpoint cannot be used for playback');
      }
      videoMetadata[quality] = {
        url,
        key: update?.dub?.keys?.[quality] || null,
        storageProvider: update?.dub?.storageProvider || 'r2',
        size: update?.dub?.sizes?.[quality] || null,
        mimeType: update?.dub?.mimeTypes?.[quality] || null,
      };
    }
  });

  console.log('[MongoDB Update] Video metadata extracted:', videoMetadata);

  const anime = await Anime.findOne(query);
  if (!anime) {
    console.error('[MongoDB Update] Anime not found:', query);
    return res.status(404).json({ ok: false, error: 'Anime not found.' });
  }

  console.log('[MongoDB Update] Anime found:', anime.title);

  anime.episodesMedia = Array.isArray(anime.episodesMedia) ? anime.episodesMedia : [];
  const idx = anime.episodesMedia.findIndex(e => Number(e.episodeNumber) === episodeNumber);

  const nextEpisode = {
    episodeNumber,
    episodeTitle: String(episodeTitle || ''),
    thumbnail: String(thumbnail || ''),
    introStart: introStart ?? undefined,
    introEnd: introEnd ?? undefined,
    outroStart: outroStart ?? undefined,
    outroEnd: outroEnd ?? undefined,
    sub: { qualities: { ...(subQualities || {}) } },
    dub: { qualities: { ...(dubQualities || {}) } },
    // Store video metadata for each quality
    videoMetadata: videoMetadata,
  };

  // Remove undefined fields so Mongoose default values can apply on insert
  Object.keys(nextEpisode).forEach((k) => {
    if (nextEpisode[k] === undefined) delete nextEpisode[k];
  });

  if (idx >= 0) {
    console.log('[MongoDB Update] Updating existing episode:', episodeNumber);
    anime.episodesMedia[idx] = nextEpisode;
  } else {
    console.log('[MongoDB Update] Adding new episode:', episodeNumber);
    anime.episodesMedia.push(nextEpisode);
  }

  // Keep numeric hint display value (max episodes)
  anime.episodes = Math.max(Number(anime.episodes || 1), episodeNumber);
  anime.newEpisode = true;
  anime.status = update?.status || 'Airing';

  console.log('[MongoDB Update] Saving to database...');
  await anime.save();
  console.log('[MongoDB Update] Saved successfully');
  
  res.json({ ok: true, anime: normalizeAnime(anime) });
});

// Delete one episode from a series (anime only)
app.delete('/api/anime/:id/episodes/:episodeNumber', requireDb, requireAdmin, async (req, res) => {
  const query = /^\d+$/.test(req.params.id)
    ? { clientId: Number(req.params.id) }
    : { _id: req.params.id };

  const episodeNumber = Number(req.params.episodeNumber);
  if (!Number.isFinite(episodeNumber) || episodeNumber < 1) {
    return res.status(400).json({ ok: false, error: 'episodeNumber must be >= 1' });
  }

  const anime = await Anime.findOne(query);
  if (!anime) return res.status(404).json({ ok: false, error: 'Anime not found.' });

  anime.episodesMedia = Array.isArray(anime.episodesMedia) ? anime.episodesMedia : [];
  anime.episodesMedia = anime.episodesMedia.filter(e => Number(e?.episodeNumber) !== episodeNumber);

  // Recompute numeric episodes hint (max episode number) but keep at least 1
  const maxEp = anime.episodesMedia.reduce((m, e) => Math.max(m, Number(e?.episodeNumber) || 0), 1);
  anime.episodes = Math.max(Number(maxEp || 1), 1);

  // Keep status/newEpisode stable for UI; don't force newEpisode on delete.
  anime.newEpisode = false;

  await anime.save();
  res.json({ ok: true, anime: normalizeAnime(anime) });
});

// Upsert movie media (single video player)
app.put('/api/anime/:id/movieMedia', requireDb, requireActiveUser, async (req, res) => {
  const query = /^\d+$/.test(req.params.id)
    ? { clientId: Number(req.params.id) }
    : { _id: req.params.id };

  const update = req.body || {};
  const qualities = update?.qualities || {};

  const anime = await Anime.findOne(query);
  if (!anime) return res.status(404).json({ ok: false, error: 'Anime not found.' });

  anime.movieMedia = anime.movieMedia || { qualities: {} };
  anime.movieMedia.qualities = qualities;

  // Keep episodes hint stable for UI (movies use episodes as a display field)
  anime.newEpisode = false;
  if (!anime.episodes || anime.episodes < 1) anime.episodes = 1;

  await anime.save();
  res.json({ ok: true, anime: normalizeAnime(anime) });
});

app.put('/api/anime/:id', requireDb, requireActiveUser, async (req, res) => {

  const query = /^\d+$/.test(req.params.id)
    ? { clientId: Number(req.params.id) }
    : { _id: req.params.id };
  const payload = { ...req.body };
  if (Array.isArray(payload.genres)) payload.genres = normalizeGenreList(payload.genres);
  const anime = await Anime.findOneAndUpdate(query, payload, { returnDocument: 'after', upsert: false });
  if (!anime) return res.status(404).json({ ok: false, error: 'Anime not found.' });
  await syncGenreCounts();
  res.json({ ok: true, anime: normalizeAnime(anime) });
});

app.delete('/api/anime/:id', requireDb, requireAdmin, async (req, res) => {
  const query = /^\d+$/.test(req.params.id)
    ? { clientId: Number(req.params.id) }
    : { _id: req.params.id };

  const deleted = await Anime.findOneAndDelete(query);
  if (!deleted) {
    return res.status(404).json({ ok: false, error: 'Anime not found.' });
  }

  await syncGenreCounts();
  res.json({ ok: true });
});

app.get('/api/users', requireDb, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).select({ passwordHash: 0 }).lean();
  res.json({ ok: true, users });
});

app.put('/api/admin/users/:userId', requireAdmin, requireDb, async (req, res) => {
  try {
    const { userId } = req.params;
    const { plan, status, roles, banInfo } = req.body || {};

    console.log('[Admin] Update user request:', { userId, plan, status, roles, banInfo });

    if (!userId) {
      return res.status(400).json({ ok: false, error: 'User ID is required' });
    }

    // Get the target user to check their roles
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const targetRoles = Array.isArray(targetUser.roles) ? targetUser.roles : [];
    const isTargetAdmin = targetRoles.includes('admin') || targetRoles.includes('moderator') || targetRoles.includes('shield');

    // Prevent banning admin users
    if (status === 'Banned' && isTargetAdmin) {
      return res.status(403).json({ ok: false, error: 'Cannot ban admin users' });
    }

    const updateData = {};
    if (plan !== undefined) updateData.plan = plan;
    if (status !== undefined) updateData.status = status;
    if (roles !== undefined) updateData.roles = roles;

    // Handle banInfo when banning a user
    if (status === 'Banned') {
      updateData.banInfo = banInfo || {
        reason: 'Violation of Community Guidelines',
        bannedAt: new Date(),
        banEnds: null,
        bannedBy: req.auth.username || 'Admin',
      };
      console.log('[Admin] Setting user as Banned with banInfo:', updateData.banInfo);
    } else if (status === 'Active') {
      // Clear banInfo when unbanning
      updateData.$unset = { banInfo: 1 };
      console.log('[Admin] Setting user as Active, clearing banInfo');
    }

    console.log('[Admin] Update data:', updateData);

    const user = await User.findByIdAndUpdate(userId, updateData, { returnDocument: 'after' }).select({ passwordHash: 0 }).lean();

    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    console.log('[Admin] User updated successfully:', { userId, status: user.status, banInfo: user.banInfo });

    res.json({ ok: true, user });
  } catch (e) {
    console.error("Update user error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------------- Auth ----------------
function getMailer() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  
  if (!user || !pass || !host || !port) return null;

  return nodemailer.createTransport({
    host,
    port: parseInt(port),
    secure: false, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });
}

function getOtpEmailTemplate(code) {
  try {
    const templatePath = path.join(__dirname, 'templates', 'otp-email.html');
    let template = fs.readFileSync(templatePath, 'utf-8');
    
    // Replace placeholders
    template = template.replace('{{OTP_CODE}}', code);
    template = template.replace('{{VERIFY_URL}}', `${process.env.APP_URL || 'http://localhost:3000'}/verify-otp`);
    
    return template;
  } catch (error) {
    console.error('Error loading email template:', error);
    // Fallback to simple HTML if template fails
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0B0B12;">
        <h1 style="color: #6C3BFF;">Verify Your Email</h1>
        <p style="color: #AAAAAA;">Your verification code is:</p>
        <div style="background: linear-gradient(135deg, #6C3BFF 0%, #8B5CF6 100%); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
          <span style="font-size: 48px; font-weight: bold; color: #FFFFFF; letter-spacing: 8px;">${code}</span>
        </div>
        <p style="color: #AAAAAA;">This code expires in 10 minutes.</p>
      </div>
    `;
  }
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

app.post('/api/auth/register', requireDb, async (req, res) => {
  try {
    const { name, username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ ok: false, error: 'username, email and password are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedUsername = String(username).trim();

    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      // Apply defaults for missing fields (for users created before schema update)
      if (existingEmail.isVerified === undefined) existingEmail.isVerified = false;
      if (existingEmail.status === undefined) existingEmail.status = 'pending';
      if (!existingEmail.roles || !Array.isArray(existingEmail.roles)) existingEmail.roles = ['user'];
      return res.status(409).json({ ok: false, error: 'Email already exists.' });
    }

    const existingUser = await User.findOne({ username: normalizedUsername });
    if (existingUser) return res.status(409).json({ ok: false, error: 'Username already exists.' });

    // Generate the first OTP before creating the user so it is stored inside
    // the same User document from the start.
    const mailer = getMailer();
    if (!mailer) {
      console.error('SMTP not configured. Missing EMAIL_USER, EMAIL_APP_PASSWORD, SMTP_HOST, or SMTP_PORT');
      return res.status(500).json({ ok: false, error: 'SMTP not configured. Set EMAIL_USER, EMAIL_APP_PASSWORD, SMTP_HOST, and SMTP_PORT in .env.' });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Create user in pending verification state
    const passwordHash = await bcrypt.hash(String(password), 10);
    // For security, registration endpoint should only create users with the 'user' role.
    // Admin creation should be handled by a separate, secure script or internal process.
    const user = await User.create({
      name: name || normalizedUsername,
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      avatar: req.body.avatar || undefined,
      plan: req.body.plan || 'Free',
      isVerified: false,
      status: 'pending',
      roles: ['user'],
      emailVerification: { code, expiresAt, attempts: 0, maxAttempts: 5, lastResendAt: new Date() },
    });

    const fromName = process.env.EMAIL_FROM_NAME || 'Anify';
    const htmlContent = getOtpEmailTemplate(code);
    
    try {
      const info = await mailer.sendMail({
        from: `${fromName} <${process.env.EMAIL_USER}>`,
        to: normalizedEmail,
        subject: 'Verify Your Email - Anify',
        html: htmlContent,
        text: `Your ANIFY verification code is: ${code}. It expires in 10 minutes.`
      });
      console.log('Email sent successfully:', info.messageId);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      return res.status(500).json({ 
        ok: false, 
        error: `Failed to send OTP email: ${emailError.message}. Check your Gmail App Password and ensure 2FA is enabled.` 
      });
    }

    res.status(201).json({ ok: true, message: 'OTP sent', userId: String(user._id), email: user.email });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post('/api/auth/verify-otp', requireDb, async (req, res) => {
  try {
    const { email, code, username, lastAnime, lastEpisode, lastPlaybackTime } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ ok: false, error: 'email and code are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    
    // Check if user is an admin - admins don't need OTP verification
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      // Apply defaults for missing fields (for users created before schema update)
      if (user.isVerified === undefined) user.isVerified = false;
      if (user.status === undefined) user.status = 'pending';
      if (!user.roles || !Array.isArray(user.roles)) user.roles = ['user'];

      const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');
      if (isAdmin) {
        return res.status(400).json({ ok: false, error: 'Admin accounts do not require email verification.' });
      }
    }
    
    if (!user) return res.status(400).json({ ok: false, error: 'User not found.' });
    const otp = user.emailVerification;
    if (!otp) return res.status(400).json({ ok: false, error: 'OTP not found or expired.' });

    // Check if OTP has expired
    if (new Date(otp.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ ok: false, error: 'This verification code has expired. Please request a new one.' });
    }

    // Check if maximum attempts reached
    if (otp.attempts >= otp.maxAttempts) {
      return res.status(400).json({ ok: false, error: 'Maximum verification attempts reached. Please request a new code.' });
    }

    // Increment attempt counter
    const attempts = Number(otp.attempts || 0) + 1;
    await User.collection.updateOne(
      { _id: user._id },
      { $set: { 'emailVerification.attempts': attempts, updatedAt: new Date() } }
    );

    // Verify OTP code
    if (String(otp.code) !== String(code)) {
      const remainingAttempts = otp.maxAttempts - attempts;
      return res.status(400).json({ 
        ok: false, 
        error: remainingAttempts > 0 
          ? `The verification code is incorrect. ${remainingAttempts} attempts remaining.` 
          : 'Maximum verification attempts reached. Please request a new code.'
      });
    }

    console.log('[Auth] Before update - User state:', {
      email: user.email,
      isVerified: user.isVerified,
      status: user.status,
      userId: user._id
    });

    // Persist verification before issuing a token. Do a direct write followed by
    // a fresh read so a success response can never be returned for an account
    // that remains pending in MongoDB.
    let updatedUser;
    try {
      // Use the native MongoDB collection here. This avoids Mongoose strict-mode
      // stripping verification fields for documents created with an older User
      // schema that did not yet contain these fields.
      const updateResult = await User.collection.updateOne(
        { _id: user._id },
        {
          $set: {
            isVerified: true,
            status: 'active',
            roles: user.roles && Array.isArray(user.roles) ? user.roles : ['user'],
            updatedAt: new Date()
          },
          $unset: { emailVerification: '' }
        }
      );

      if (updateResult.matchedCount !== 1 || updateResult.modifiedCount !== 1) {
        throw new Error(`Verification update was not applied (matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}).`);
      }

      const persistedUser = await User.collection.findOne({ _id: user._id });
      if (!persistedUser?.isVerified || persistedUser.status !== 'active') {
        throw new Error('Verification update could not be confirmed from MongoDB.');
      }

      updatedUser = await User.findById(user._id);
    } catch (updateError) {
      console.error('[Auth] User update failed:', updateError);
      return res.status(500).json({ ok: false, error: `Failed to update user: ${updateError.message}` });
    }

    if (!updatedUser) {
      return res.status(500).json({ ok: false, error: 'Failed to update user verification status.' });
    }

    console.log('[Auth] User update successful:', {
      email: updatedUser.email,
      isVerified: updatedUser.isVerified,
      status: updatedUser.status,
      roles: updatedUser.roles
    });

    // Fetch the user again to verify the update persisted
    const verifiedUser = await User.findOne({ email: normalizedEmail });
    console.log('[Auth] After update - Verified user from DB:', {
      email: verifiedUser.email,
      isVerified: verifiedUser.isVerified,
      status: verifiedUser.status,
      roles: verifiedUser.roles
    });

    const payload = { userId: String(updatedUser._id), username: updatedUser.username, roles: updatedUser.roles, isVerified: updatedUser.isVerified, status: updatedUser.status };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });

    const responseData = {
      ok: true,
      token,
      user: { id: updatedUser._id, username: updatedUser.username, email: updatedUser.email, name: updatedUser.name, roles: updatedUser.roles, plan: updatedUser.plan, status: updatedUser.status, isVerified: updatedUser.isVerified }
    };

    // Include last watched data if provided (for guest resume after registration)
    if (lastAnime && lastEpisode) {
      responseData.resumeWatch = {
        animeId: lastAnime,
        episodeId: lastEpisode,
        playbackTime: lastPlaybackTime || 0
      };
    }

    return res.json(responseData);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post('/api/auth/resend-otp', requireDb, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ ok: false, error: 'email is required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    
    // Check if user exists
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found.' });
    }

    // Apply defaults for missing fields (for users created before schema update)
    if (user.isVerified === undefined) user.isVerified = false;
    if (user.status === undefined) user.status = 'pending';
    if (!user.roles || !Array.isArray(user.roles)) user.roles = ['user'];

    // Check if user is an admin - admins don't need OTP verification
    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');
    if (isAdmin) {
      return res.status(400).json({ ok: false, error: 'Admin accounts do not require email verification.' });
    }

    // Check if user is already verified
    if (user.isVerified && user.status === 'active') {
      return res.status(400).json({ ok: false, error: 'Email is already verified.' });
    }

    // Check rate limiting (minimum 60 seconds between resends)
    const existingOtp = user.emailVerification;
    if (existingOtp?.lastResendAt) {
      const timeSinceLastResend = Date.now() - new Date(existingOtp.lastResendAt).getTime();
      const cooldownPeriod = 60 * 1000; // 60 seconds
      
      if (timeSinceLastResend < cooldownPeriod) {
        const remainingSeconds = Math.ceil((cooldownPeriod - timeSinceLastResend) / 1000);
        return res.status(429).json({ 
          ok: false, 
          error: `Please wait ${remainingSeconds} seconds before requesting another code.`,
          cooldownRemaining: remainingSeconds
        });
      }
    }

    // Generate new OTP
    const mailer = getMailer();
    if (!mailer) {
      return res.status(500).json({ ok: false, error: 'Email service not configured.' });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Store the replacement OTP inside the user document.
    await User.collection.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerification: { code, expiresAt, attempts: 0, maxAttempts: 5, lastResendAt: new Date() },
          updatedAt: new Date()
        }
      }
    );

    const fromName = process.env.EMAIL_FROM_NAME || 'Anify';
    const htmlContent = getOtpEmailTemplate(code);
    
    try {
      await mailer.sendMail({
        from: `${fromName} <${process.env.EMAIL_USER}>`,
        to: normalizedEmail,
        subject: 'Verify Your Email - Anify',
        html: htmlContent,
        text: `Your ANIFY verification code is: ${code}. It expires in 10 minutes.`
      });
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      return res.status(500).json({ ok: false, error: 'Failed to send verification email.' });
    }

    res.json({ 
      ok: true, 
      message: 'A new verification code has been sent to your email.',
      cooldownRemaining: 60
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Guest preview limit endpoint
app.get('/api/guest/limit', (req, res) => {
  const defaultLimit = 4;
  const configuredLimit = process.env.GUEST_PREVIEW_LIMIT || defaultLimit;
  res.json({
    ok: true,
    limit: parseInt(configuredLimit, 10)
  });
});

// Guest video watch verification endpoint
app.post('/api/guest/verify-watch', requireDb, async (req, res) => {
  try {
    const { animeId, episodeId, guestVideosWatched } = req.body || {};
    const limit = parseInt(process.env.GUEST_PREVIEW_LIMIT || '4', 10);
    
    // If user is authenticated, they can always watch
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
        if (decoded.userId) {
          return res.json({ ok: true, canWatch: true, reason: 'authenticated' });
        }
      } catch (jwtError) {
        // Token invalid, continue with guest check
      }
    }

    // Guest verification
    const count = Array.isArray(guestVideosWatched) ? guestVideosWatched.length : 0;
    const canWatch = count < limit;

    res.json({
      ok: true,
      canWatch,
      count,
      limit,
      remaining: Math.max(0, limit - count),
      reason: canWatch ? 'within_limit' : 'limit_reached'
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Get current user info endpoint
app.get('/api/auth/user', requireDb, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    res.json({
      ok: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        roles: user.roles,
        plan: user.plan,
        status: user.status,
        banInfo: user.banInfo
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post('/api/auth/login', requireDb, async (req, res) => {
  try {
    const { email, password } = req.body || {};


    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'email and password are required.' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(401).json({ ok: false, error: 'Invalid credentials.' });

    // Apply defaults for missing fields (for users created before schema update)
    if (user.isVerified === undefined) user.isVerified = false;
    if (user.status === undefined) user.status = 'pending';
    if (!user.roles || !Array.isArray(user.roles)) user.roles = ['user'];

    console.log('[Auth] Login - User fetched from DB:', {
      email: user.email,
      isVerified: user.isVerified,
      status: user.status,
      roles: user.roles,
      userId: user._id
    });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: 'Invalid credentials.' });

    // Debug logging
    console.log('[Auth] Login attempt:', {
      email: user.email,
      isVerified: user.isVerified,
      status: user.status,
      roles: user.roles
    });

    // Skip email verification for admin users (including seeded admin)
    const isAdmin = Array.isArray(user.roles) && (user.roles.includes('admin') || user.roles.includes('moderator') || user.roles.includes('shield'));
    console.log('[Auth] Login - isAdmin check result:', isAdmin, 'User roles:', user.roles);
    
    // Check if user has verified their email (skip for admins)
    const isVerifiedByFlag = user.isVerified === true;
    console.log('[Auth] Login - isVerifiedByFlag check result:', isVerifiedByFlag, 'User isVerified:', user.isVerified);
    if (!isVerifiedByFlag && !isAdmin) {
      // Generate new OTP and send email
      const mailer = getMailer();
      if (mailer) {
        const code = generateOtpCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await User.collection.updateOne(
          { _id: user._id },
          {
            $set: {
              emailVerification: { code, expiresAt, attempts: 0, maxAttempts: 5, lastResendAt: new Date() },
              updatedAt: new Date()
            }
          }
        );

        const fromName = process.env.EMAIL_FROM_NAME || 'Anify';
        const htmlContent = getOtpEmailTemplate(code);
        
        try {
          await mailer.sendMail({
            from: `${fromName} <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Verify Your Email - Anify',
            html: htmlContent,
            text: `Your ANIFY verification code is: ${code}. It expires in 10 minutes.`
          });
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError);
        }
      }

      return res.status(403).json({ 
        ok: false, 
        error: 'Please verify your email address',
        requiresVerification: true,
        email: user.email
      });
    }

    // Check if user is banned
    if (user.status === 'Banned') {
      console.log('[Auth] User is banned:', { userId: user._id, username: user.username, banInfo: user.banInfo });
      const payload = { userId: String(user._id), username: user.username, roles: user.roles, status: user.status, isVerified: user.isVerified };
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });

      return res.json({
        ok: true,
        token,
        user: { 
          id: user._id, 
          username: user.username, 
          email: user.email, 
          name: user.name, 
          roles: user.roles, 
          plan: user.plan, 
          status: user.status,
          isVerified: user.isVerified,
          banInfo: user.banInfo
        },
        banned: true,
      });
    }

    const payload = { userId: String(user._id), username: user.username, roles: user.roles, status: user.status, isVerified: user.isVerified };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });

    res.json({
      ok: true,
      token,
      user: { id: user._id, username: user.username, email: user.email, name: user.name, roles: user.roles, plan: user.plan, status: user.status, isVerified: user.isVerified, banInfo: user.banInfo },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Missing token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.auth = decoded;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

function requireActiveUser(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const user = await User.findById(req.auth.userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: 'User not found' });
      }

      // Check if user is banned
      if (user.status === 'Banned') {
        return res.status(403).json({ 
          ok: false, 
          error: 'Your account has been banned. You are not allowed to perform this action.',
          banned: true,
          banInfo: user.banInfo
        });
      }

      // Check if user is pending (unverified)
      if (user.status === 'Pending') {
        return res.status(403).json({ 
          ok: false, 
          error: 'Please verify your email address before performing this action.' 
        });
      }

      // User is active, proceed
      req.user = user;
      next();
    } catch (error) {
      return res.status(500).json({ ok: false, error: String(error?.message || error) });
    }
  });
}

// Middleware to check if user is banned and redirect to banned page
function checkBanStatus(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const user = await User.findById(req.auth.userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: 'User not found' });
      }

      // Check if user is banned
      if (user.status === 'Banned') {
        // Check if ban has expired
        if (user.banInfo && user.banInfo.banEnds && new Date(user.banInfo.banEnds) < new Date()) {
          // Auto-restore expired bans
          await User.findByIdAndUpdate(user._id, {
            status: 'Active',
            $unset: { banInfo: 1 }
          });
          next();
        } else {
          // User is still banned, redirect to banned page
          return res.redirect('/account-banned');
        }
      } else {
        next();
      }
    } catch (error) {
      return res.status(500).json({ ok: false, error: String(error?.message || error) });
    }
  });
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    const roles = Array.isArray(req.auth?.roles) ? req.auth.roles : [];
    const isAdmin = roles.includes('admin') || roles.includes('moderator') || roles.includes('shield');

    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Forbidden: Admin access required.' });
    }
    next();
  });
}


// --------------- Comments ---------------
app.get('/api/anime/:id/comments', async (req, res) => {
  if (!requireDbForGet({ ok: false, comments: [] , error: 'MongoDB is not connected.' }, res)) return;
  const animeId = String(req.params.id);
  const comments = await Comment.find({ animeId })
    .sort({ createdAt: -1 })
    .lean();

  res.json({ ok: true, comments });
});

app.post('/api/comments', requireDb, requireActiveUser, async (req, res) => {
  try {
    const { animeId, text } = req.body || {};
    if (!animeId || !text) return res.status(400).json({ ok: false, error: 'animeId and text are required.' });

    const comment = await Comment.create({
      animeId: String(animeId),
      userId: String(req.auth.userId),
      text: String(text),
      likes: 0,
    });

    res.status(201).json({ ok: true, comment });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// --------------- Watch progress ---------------
app.get('/api/watch-progress/:userId', requireDb, async (req, res) => {
  const progress = await WatchProgress.find({ userId: req.params.userId }).sort({ updatedAt: -1 }).lean();
  res.json({ ok: true, progress });
});

app.post('/api/watch-progress', requireDb, requireActiveUser, async (req, res) => {
  const { userId = 'guest', animeId, episode = 1, language = 'sub' } = req.body;
  const progress = await WatchProgress.findOneAndUpdate(
    { userId, animeId, episode, language },
    req.body,
    { upsert: true, new: true }
  );
  res.json({ ok: true, progress });
});


app.post('/api/upload-video', upload.single('video'), (req, res) => sendUploadedFile(req, res, 'video'));
app.post('/api/upload-media', upload.single('media'), (req, res) => sendUploadedFile(req, res, 'media'));

// Temporary endpoint to check user data
app.get('/api/admin/check-user/:email', requireDb, async (req, res) => {
  try {
    const email = String(req.params.email).toLowerCase().trim();
    const user = await User.findOne({ email: email });
    
    if (user) {
      res.json({ 
        ok: true, 
        user: {
          email: user.email,
          username: user.username,
          roles: user.roles,
          status: user.status,
          isVerified: user.isVerified,
          plan: user.plan,
          fullUser: user.toObject()
        }
      });
    } else {
      res.status(404).json({ ok: false, error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

// Temporary endpoint to fix isVerified field
app.post('/api/admin/fix-user-verification', requireDb, async (req, res) => {
  try {
    const { email } = req.body || {};
    
    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email is required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    
    console.log('[Fix User] Looking for user:', normalizedEmail);
    
    // Find user first
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    console.log('[Fix User] User found before update:', {
      email: user.email,
      isVerified: user.isVerified,
      status: user.status,
      roles: user.roles
    });

    // Update fields directly
    user.isVerified = true;
    user.status = 'active';
    user.roles = ['admin'];
    
    await user.save();
    
    console.log('[Fix User] User after save:', {
      email: user.email,
      isVerified: user.isVerified,
      status: user.status,
      roles: user.roles
    });

    res.json({ 
      ok: true, 
      message: 'User verification fixed successfully',
      user: {
        email: user.email,
        username: user.username,
        roles: user.roles,
        status: user.status,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error('[Fix User] Error:', error);
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`MongoDB: ${dbReady ? 'connected' : hasMongo ? 'connecting...' : 'not configured'}`);
  console.log("Storage: Cloudinary");
});
