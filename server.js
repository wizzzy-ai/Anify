import dotenv from "dotenv";
dotenv.config();

import dns from "node:dns";
import https from 'https';
import { EventEmitter } from 'node:events';

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
import bcrypt from 'bcryptjs';
import User from './User.js'; // Import the centralized User model
import Anime from './models/Anime.js'; // Import the canonical Anime model
import Rating from './models/Rating.js'; // Import the Rating model
import PlatformSettings from './models/PlatformSettings.js';
import Announcement from './models/Announcement.js';
import Donation from './Donation.js';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const PROFILE_THEME_IDS = [
  'default', 'crimson', 'ocean', 'sakura', 'emerald', 'violet', 'azure', 'sunset', 'ice', 'cyber', 'royal',
  'blush', 'peony', 'fuchsia', 'berry', 'coral', 'ash-plum', 'pink', 'obsidian', 'red', 'cobalt-sand', 'ink-peach', 'khaki-violet', 'rosewood-sage-navy', 'cotton-candy', 'rose-gold',
];
const PROFILE_AVATAR_IDS = ['shadow', 'moon', 'ember', 'tide', 'orchid', 'solar', 'mask', 'ninja', 'samurai', 'chibi', 'nocturne', 'fae', 'storm', 'rosewood', 'starlight', 'rune', 'aqua', 'scarlet', 'sage', 'onyx'];
const LEGACY_PROFILE_THEME_MAP = { gold: 'default', rose: 'sakura', violet: 'violet', ocean: 'ocean', watermelon: 'obsidian', plum: 'ash-plum' };
const DEFAULT_PROFILE_THEME = 'default';
const DEFAULT_AVATAR_ID = 'shadow';

function normalizeProfileTheme(value) {
  const candidate = String(value || '').trim().toLowerCase();
  const mapped = LEGACY_PROFILE_THEME_MAP[candidate] || candidate;
  return PROFILE_THEME_IDS.includes(mapped) ? mapped : DEFAULT_PROFILE_THEME;
}

function normalizeAvatarId(value) {
  const candidate = String(value || '').trim().toLowerCase();
  return PROFILE_AVATAR_IDS.includes(candidate) ? candidate : DEFAULT_AVATAR_ID;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

// During maintenance, regular visitors cannot use API data or perform actions.
// Admins are intentionally exempt so they can enter the dashboard and turn the
// switch back off.
let maintenanceModeEnabled = false;
let maintenanceModeLastChecked = 0;
let supportEnabled = false;
let supportEnabledLastChecked = 0;
const maintenanceEvents = new EventEmitter();
maintenanceEvents.setMaxListeners(0);

function broadcastMaintenanceMode() {
  maintenanceEvents.emit('change', { maintenanceMode: maintenanceModeEnabled, supportEnabled });
}

function broadcastSupportEnabled() {
  maintenanceEvents.emit('change', { maintenanceMode: maintenanceModeEnabled, supportEnabled });
}

async function getMaintenanceMode() {
  if (!dbReady) return false;
  if (Date.now() - maintenanceModeLastChecked < 5000) return maintenanceModeEnabled;

  const settings = await PlatformSettings.findOne({ key: 'platform' }).lean();
  maintenanceModeEnabled = settings?.maintenanceMode === true;
  maintenanceModeLastChecked = Date.now();
  return maintenanceModeEnabled;
}

async function getSupportEnabled() {
  if (!dbReady) return false;
  if (Date.now() - supportEnabledLastChecked < 5000) return supportEnabled;

  const settings = await PlatformSettings.findOne({ key: 'platform' }).lean();
  supportEnabled = settings?.supportEnabled === true;
  supportEnabledLastChecked = Date.now();
  return supportEnabled;
}

function requestHasAdminToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !process.env.JWT_SECRET) return false;

  try {
    const roles = jwt.verify(token, process.env.JWT_SECRET)?.roles || [];
    return Array.isArray(roles) && (roles.includes('admin') || roles.includes('moderator') || roles.includes('shield'));
  } catch {
    return false;
  }
}

app.use('/api', async (req, res, next) => {
  const allowedDuringMaintenance = req.path === '/platform-settings' || req.path === '/platform-settings/stream' || req.path.startsWith('/admin/platform-settings') || req.path.startsWith('/auth/');
  if (allowedDuringMaintenance || requestHasAdminToken(req)) return next();

  try {
    if (await getMaintenanceMode()) {
      return res.status(503).json({ ok: false, maintenanceMode: true, error: 'Anify is temporarily unavailable for maintenance.' });
    }
  } catch (error) {
    console.error('[Maintenance] Could not read platform setting:', error.message);
  }
  next();
});

// Set Content Security Policy header
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: http: ws: wss: data: blob:; connect-src 'self' https: http: ws: wss: localhost 127.0.0.1; img-src 'self' https: http: data: blob:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:;");
  next();
});

// Increase server timeout for large file uploads
app.use((req, res, next) => {
  res.setTimeout(600000, () => {
    console.log('[Server] Request timeout for:', req.url);
    if (!res.headersSent) {
      res.status(408).json({ ok: false, error: 'Request timeout. Please try again.' });
    }
  });
  next();
});

// Serve anify.html as default for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'anify.html'));
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    dbReady: dbReady,
    timestamp: new Date().toISOString()
  });
});

// Test email endpoint
app.get('/test-email', async (req, res) => {
  const mailer = getMailer();
  if (!mailer) {
    return res.status(500).json({ 
      ok: false, 
      error: 'Email configuration missing',
      config: {
        hasUser: !!process.env.EMAIL_USER,
        hasPass: !!process.env.EMAIL_APP_PASSWORD,
        hasHost: !!process.env.SMTP_HOST,
        hasPort: !!process.env.SMTP_PORT
      }
    });
  }

  try {
    await mailer.verify();
    res.json({ 
      ok: true, 
      message: 'SMTP configuration is valid',
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.EMAIL_USER
      }
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message,
      details: error
    });
  }
});

// Country detection endpoint (server-side, secure)
app.get('/api/country', async (req, res) => {
  try {
    const apiKey = process.env.IPINFO_TOKEN;
    
    if (!apiKey) {
      throw new Error('IPinfo API key not configured');
    }
    
    // Get client IP address, considering proxy headers
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                     req.headers['cf-connecting-ip'] ||
                     req.headers['x-real-ip'] || 
                     req.socket?.remoteAddress ||
                     req.ip;
    
    console.log('[COUNTRY DEBUG] STEP 1 - Client IP:', clientIp);
    console.log('[COUNTRY DEBUG] STEP 2 - About to call IPinfo');
    
    // Check if request is from localhost
    const isLocalhost = clientIp === '::1' || 
                        clientIp === '127.0.0.1' || 
                        clientIp === '::ffff:127.0.0.1' ||
                        clientIp?.startsWith('192.168.') ||
                        clientIp?.startsWith('10.') ||
                        clientIp?.startsWith('172.');
    
    if (isLocalhost) {
      // Development-only fallback
      return res.json({
        ok: true,
        country: "NG",
        development: true
      });
    }
    
    // Production: Use IPinfo lite endpoint with client IP
    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'ipinfo.io',
        path: `/lite/${clientIp}?token=${apiKey}`,
        method: 'GET',
        timeout: 10000
      };
      
      const req = https.request(options, (response) => {
        console.log('[COUNTRY DEBUG] STEP 3 - IPinfo request completed');
        console.log('[COUNTRY DEBUG] STEP 3 - HTTP status:', response.statusCode);
        console.log('[COUNTRY DEBUG] STEP 3 - Content-Type:', response.headers['content-type']);
        
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          console.log('[COUNTRY DEBUG] STEP 4 - Raw IPinfo response:', body);
          try {
            const parsed = JSON.parse(body);
            console.log('[COUNTRY DEBUG] STEP 5 - Parsed IPinfo data:', parsed);
            resolve(parsed);
          } catch (e) {
            console.error('[COUNTRY DEBUG] JSON PARSE ERROR:', e);
            reject(e);
          }
        });
      });
      
      req.on('error', (e) => {
        reject(e);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
    
    console.log('[COUNTRY DEBUG] STEP 6 - Country:', data.country);
    console.log('[COUNTRY DEBUG] STEP 6 - Country code:', data.countryCode);
    
    if (data.country) {
      return res.json({ 
        ok: true, 
        country: data.country 
      });
    }
    
    throw new Error('No country code found');
    
  } catch (error) {
    console.error('[COUNTRY DEBUG] ACTUAL ERROR:', error?.message);
    console.error('[COUNTRY DEBUG] STACK:', error?.stack);
    return res.status(500).json({
      ok: false,
      country: null,
      error: 'Country detection failed'
    });
  }
});

// Banned page route
app.get('/account-banned', (req, res) => {
  res.sendFile(path.join(__dirname, 'account-banned.html'));
});

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const hasMongo = Boolean(process.env.MONGODB_URI);

// TEMP: Disable JWT_SECRET check for testing CREATE flow
// if (!process.env.JWT_SECRET) {
//   console.error('ERROR: JWT_SECRET environment variable is not set. Please add it to your .env file.');
//   process.exit(1);
// }

let dbReady = false;
if (hasMongo) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      dbReady = true;
      return PlatformSettings.findOne({ key: 'platform' }).lean();
    })
    .then((settings) => {
      maintenanceModeEnabled = settings?.maintenanceMode === true;
      maintenanceModeLastChecked = Date.now();
      supportEnabled = settings?.supportEnabled === true;
      supportEnabledLastChecked = Date.now();
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
  rating: { type: Number, min: 1, max: 5, default: null },
  likes: { type: Number, default: 0 },
}, { timestamps: true });

const genreSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true, index: true },
  slug: { type: String, required: true, trim: true, unique: true, index: true },
  description: { type: String, default: '' },
  animeCount: { type: Number, default: 0 },
}, { timestamps: true });

const WatchProgress = mongoose.models.WatchProgress || mongoose.model('WatchProgress', watchProgressSchema);
const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
const Genre = mongoose.models.Genre || mongoose.model('Genre', genreSchema);

// Public read endpoint lets the web app show a clear maintenance screen before
// rendering the normal experience. Only admins may change this setting.
app.get('/api/platform-settings', async (req, res) => {
  try {
    const maintenanceMode = await getMaintenanceMode();
    const supportEnabled = await getSupportEnabled();
    // This switch must always reflect the latest admin change. A cached
    // "false" response would allow the UI to show fallback content while the
    // API itself is already in maintenance mode.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ ok: true, maintenanceMode, supportEnabled });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

// Keeps open browser tabs informed the instant an admin changes maintenance
// mode. Server-Sent Events work without adding another realtime dependency.
app.get('/api/platform-settings/stream', async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  const send = (state) => res.write(`data: ${JSON.stringify(state)}\n\n`);
  send({ maintenanceMode: await getMaintenanceMode(), supportEnabled: await getSupportEnabled() });

  const onChange = (state) => send(state);
  maintenanceEvents.on('change', onChange);
  const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    maintenanceEvents.off('change', onChange);
  });
});

app.put('/api/admin/platform-settings', requireDb, requireAdmin, async (req, res) => {
  const { maintenanceMode, supportEnabled } = req.body || {};
  if (typeof maintenanceMode !== 'boolean' && typeof supportEnabled !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'maintenanceMode or supportEnabled must be true or false.' });
  }

  try {
    const updateData = {};
    if (typeof maintenanceMode === 'boolean') {
      updateData.maintenanceMode = maintenanceMode;
    }
    if (typeof supportEnabled === 'boolean') {
      updateData.supportEnabled = supportEnabled;
    }

    await PlatformSettings.findOneAndUpdate(
      { key: 'platform' },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    if (typeof maintenanceMode === 'boolean') {
      maintenanceModeEnabled = maintenanceMode;
      maintenanceModeLastChecked = Date.now();
      broadcastMaintenanceMode();
    }
    if (typeof supportEnabled === 'boolean') {
      supportEnabled = supportEnabled;
      supportEnabledLastChecked = Date.now();
      broadcastSupportEnabled();
    }
    
    res.json({ ok: true, maintenanceMode: maintenanceModeEnabled, supportEnabled });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

// DEBUG: Log the actual Anime schema being used at runtime
console.log('[ANIME MODEL DEBUG] Anime model name:', Anime.modelName);
console.log('[ANIME MODEL DEBUG] Schema paths:', Object.keys(Anime.schema.paths));
console.log('[ANIME MODEL DEBUG] Has status field:', 'status' in Anime.schema.paths);
console.log('[ANIME MODEL DEBUG] Has rating field:', 'rating' in Anime.schema.paths);
console.log('[ANIME MODEL DEBUG] Has trending field:', 'trending' in Anime.schema.paths);
console.log('[ANIME MODEL DEBUG] Has newEpisode field:', 'newEpisode' in Anime.schema.paths);
console.log('[ANIME MODEL DEBUG] Has genres field:', 'genres' in Anime.schema.paths);
console.log('[ANIME MODEL DEBUG] Has studio field:', 'studio' in Anime.schema.paths);
console.log('[ANIME MODEL DEBUG] Has desc field:', 'desc' in Anime.schema.paths);
console.log('[ANIME MODEL DEBUG] Has year field:', 'year' in Anime.schema.paths);
console.log('[ANIME MODEL DEBUG] Has premium field:', 'premium' in Anime.schema.paths);
console.log('[ANIME MODEL DEBUG] Has featured field:', 'featured' in Anime.schema.paths);
console.log('[ANIME MODEL DEBUG] Has titleJp field:', 'titleJp' in Anime.schema.paths);


const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1 GB
    fieldSize: 1024 * 1024 * 1024, // 1 GB
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
        episodeTitle: e.episodeTitle || '',
        thumbnail: e.thumbnail || '',
        introStart: e.introStart,
        introEnd: e.introEnd,
        outroStart: e.outroStart,
        outroEnd: e.outroEnd,
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
    
    // Ensure all other fields are included
    title: obj.title,
    titleJp: obj.titleJp,
    desc: obj.desc,
    year: obj.year,
    studio: obj.studio,
    genres: obj.genres,
    status: obj.status,
    premium: obj.premium,
    featured: obj.featured,
    rating: obj.rating,
    trending: obj.trending,
    newEpisode: obj.newEpisode,
    bannerDisplay: obj.bannerDisplay,
    trailer: obj.trailer,
    introStart: obj.introStart,
    introEnd: obj.introEnd,
    outroStart: obj.outroStart,
    outroEnd: obj.outroEnd,
  };
}


function requireDb(req, res, next) {
  if (!dbReady) {
    console.error('[requireDb] MongoDB not connected, rejecting request');
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
      console.log('[UPLOAD] ☁️ Uploading video to storage...');
      const { videoType = 'banner', metadata = {} } = req.body || {};
      const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      
      const isBannerVideo = fieldName !== 'video'
        && ['banner', 'banner-video', 'bannerVideo'].includes(String(videoType));
      if (isBannerVideo) {
        result = await uploadVideo(req.file, 'banner', parsedMetadata);
      } else {
        // Use extended timeout for large video files (15 minutes)
        const fileTimeout = req.file.size > 100 * 1024 * 1024 ? 900000 : 300000; // 15 min for >100MB, 5 min otherwise
        result = await uploadToR2(req.file, 'videos', { metadata: parsedMetadata, timeout: fileTimeout });
      }
      console.log('[UPLOAD] ✅ Video upload SUCCESS:', { url: result.url, key: result.key, storage: result.storage });
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
    console.error("[UPLOAD] Error details:", {
      message: e.message,
      code: e.code,
      name: e.name,
      stack: e.stack
    });

    return res.status(500).json({
      ok: false,
      error: e.message || 'Upload failed',
      code: e.code || 'UPLOAD_ERROR'
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

// Profile images are intentionally not user-uploadable. Users choose from the built-in
// avatar catalog in the profile editor; keep this response explicit for old clients.
app.post('/api/storage/upload/avatar', requireActiveUser, (req, res) => {
  res.status(410).json({ ok: false, error: 'Profile image uploads are disabled. Choose a built-in avatar instead.' });
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

// Admin statistics endpoint
app.get('/api/admin/stats', requireDb, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const premiumUsers = await User.countDocuments({ plan: { $ne: 'Free' } });
    const activeUsers = await User.countDocuments({ status: 'active' });
    
    // Enhanced user statistics
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const newUsersToday = await User.countDocuments({ createdAt: { $gte: todayStart } });
    const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: weekStart } });
    
    // User plan distribution
    const freeUsers = await User.countDocuments({ plan: 'Free' });
    const basicUsers = await User.countDocuments({ plan: 'Basic' });
    const premiumPlanUsers = await User.countDocuments({ plan: 'Premium' });
    const vipUsers = await User.countDocuments({ plan: 'VIP' });
    
    // User status distribution
    const pendingUsers = await User.countDocuments({ status: 'pending' });
    const bannedUsers = await User.countDocuments({ status: 'banned' });
    
    // Get recent users for activity feed
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select({ name: 1, username: 1, email: 1, createdAt: 1, status: 1, plan: 1 })
      .lean();
    
    // Enhanced anime statistics
    const totalAnime = await Anime.countDocuments();
    const trendingAnime = await Anime.countDocuments({ trending: true });
    const featuredAnime = await Anime.countDocuments({ featured: true });
    const premiumAnime = await Anime.countDocuments({ premium: true });
    const newEpisodesAnime = await Anime.countDocuments({ newEpisode: true });
    
    // Anime status distribution
    const ongoingAnime = await Anime.countDocuments({ status: 'Ongoing' });
    const completedAnime = await Anime.countDocuments({ status: 'Completed' });
    const upcomingAnime = await Anime.countDocuments({ status: 'Upcoming' });
    
    // Recently added anime
    const recentAnime = await Anime.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select({ title: 1, image: 1, status: 1, createdAt: 1, rating: 1 })
      .lean();
    
    // Top rated anime
    const topRatedAnime = await Anime.find()
      .sort({ averageRating: -1 })
      .limit(5)
      .select({ title: 1, image: 1, averageRating: 1, ratingCount: 1 })
      .lean();
    
    // Genre distribution
    const allAnime = await Anime.find().select({ genres: 1 }).lean();
    const genreCounts = {};
    allAnime.forEach(anime => {
      if (Array.isArray(anime.genres)) {
        anime.genres.forEach(genre => {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
      }
    });
    
    // User growth over time (last 7 days)
    const userGrowth = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const count = await User.countDocuments({
        createdAt: { $gte: dayStart, $lt: dayEnd }
      });
      userGrowth.push({
        date: dayStart.toISOString().split('T')[0],
        count: count
      });
    }
    
    // Anime growth over time (last 7 days)
    const animeGrowth = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const count = await Anime.countDocuments({
        createdAt: { $gte: dayStart, $lt: dayEnd }
      });
      animeGrowth.push({
        date: dayStart.toISOString().split('T')[0],
        count: count
      });
    }
    
    // Enhanced user analytics
    // User engagement metrics (using watch progress as proxy for engagement)
    const activeWatchers = await WatchProgress.countDocuments({
      updatedAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    // User registration trends by month (last 6 months)
    const monthlyRegistrations = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const count = await User.countDocuments({
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });
      monthlyRegistrations.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        count: count
      });
    }
    
    // User activity distribution (by last login/activity)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const activeLastDay = await User.countDocuments({ updatedAt: { $gte: oneDayAgo } });
    const activeLastWeek = await User.countDocuments({ updatedAt: { $gte: sevenDaysAgo } });
    const activeLastMonth = await User.countDocuments({ updatedAt: { $gte: thirtyDaysAgo } });
    
    // Most active users (based on recent activity)
    const mostActiveUsers = await User.find()
      .sort({ updatedAt: -1 })
      .limit(5)
      .select({ username: 1, email: 1, plan: 1, updatedAt: 1, createdAt: 1 })
      .lean();
    
    // User retention (simplified - users who registered in last month and are still active)
    const lastMonthUsers = await User.find({
      createdAt: { $gte: thirtyDaysAgo }
    }).select({ _id: 1, updatedAt: 1 }).lean();
    
    const retainedUsers = lastMonthUsers.filter(user => 
      user.updatedAt && new Date(user.updatedAt) >= sevenDaysAgo
    ).length;
    
    const retentionRate = lastMonthUsers.length > 0 
      ? Math.round((retainedUsers / lastMonthUsers.length) * 100) 
      : 0;
    
    // Time-based analytics
    // Peak usage hours (analyze user activity by hour of day)
    const hourlyActivity = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourStart = new Date(now);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hour + 1);
      
      // Count users who were active in this hour (using updatedAt as proxy)
      const count = await User.countDocuments({
        updatedAt: { $gte: hourStart, $lt: hourEnd }
      });
      
      hourlyActivity.push({
        hour: hour,
        count: count,
        label: `${hour}:00`
      });
    }
    
    // Day-of-week activity patterns
    const dayOfWeekActivity = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (let day = 0; day < 7; day++) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - dayStart.getDay() + day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const count = await User.countDocuments({
        updatedAt: { $gte: dayStart, $lt: dayEnd }
      });
      
      dayOfWeekActivity.push({
        day: dayNames[day],
        count: count
      });
    }
    
    // Seasonal trends (last 12 months)
    const seasonalTrends = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const newUsers = await User.countDocuments({
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });
      
      const activeUsers = await User.countDocuments({
        updatedAt: { $gte: monthStart, $lte: monthEnd }
      });
      
      seasonalTrends.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        newUsers: newUsers,
        activeUsers: activeUsers
      });
    }
    
    // Peak usage identification
    const peakHour = hourlyActivity.reduce((max, hour) => hour.count > max.count ? hour : max, hourlyActivity[0]);
    const peakDay = dayOfWeekActivity.reduce((max, day) => day.count > max.count ? day : max, dayOfWeekActivity[0]);
    
    res.json({
      ok: true,
      stats: {
        totalUsers,
        premiumUsers,
        activeUsers,
        totalAnime,
        trendingAnime,
        // Enhanced user stats
        newUsersToday,
        newUsersThisWeek,
        userPlanDistribution: {
          free: freeUsers,
          basic: basicUsers,
          premium: premiumPlanUsers,
          vip: vipUsers
        },
        userStatusDistribution: {
          active: activeUsers,
          pending: pendingUsers,
          banned: bannedUsers
        },
        // User analytics
        activeWatchers,
        userActivityDistribution: {
          lastDay: activeLastDay,
          lastWeek: activeLastWeek,
          lastMonth: activeLastMonth
        },
        retentionRate,
        monthlyRegistrations,
        // Time-based analytics
        hourlyActivity,
        dayOfWeekActivity,
        seasonalTrends,
        peakUsage: {
          hour: peakHour.label,
          hourCount: peakHour.count,
          day: peakDay.day,
          dayCount: peakDay.count
        },
        // Enhanced anime stats
        featuredAnime,
        premiumAnime,
        newEpisodesAnime,
        animeStatusDistribution: {
          ongoing: ongoingAnime,
          completed: completedAnime,
          upcoming: upcomingAnime
        },
        // Growth data
        userGrowth,
        animeGrowth,
        // Genre distribution
        genreDistribution: genreCounts
      },
      recentActivity: recentUsers.map(user => ({
        type: 'user',
        icon: 'user-plus',
        color: 'text-green-400',
        text: `New user registered: ${user.username || user.email}`,
        time: formatTimeAgo(user.createdAt)
      })),
      recentAnime: recentAnime.map(anime => ({
        title: anime.title,
        image: anime.image,
        status: anime.status,
        rating: anime.rating,
        createdAt: anime.createdAt
      })),
      topRatedAnime: topRatedAnime.map(anime => ({
        title: anime.title,
        image: anime.image,
        averageRating: anime.averageRating,
        ratingCount: anime.ratingCount
      })),
      mostActiveUsers: mostActiveUsers.map(user => ({
        username: user.username || user.email,
        plan: user.plan,
        lastActive: formatTimeAgo(user.updatedAt),
        memberSince: formatTimeAgo(user.createdAt)
      }))
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

// Helper function to format time ago
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }
  return 'Just now';
}

// --------------- Ratings ---------------
// Get current user's rating for an anime
app.get('/api/anime/:animeId/rating', requireDb, async (req, res) => {
  console.log('[Rating GET] Route hit for animeId:', req.params.animeId);
  try {
    const { animeId } = req.params;
    
    // Check if user is authenticated
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      console.log('[Rating GET] No token provided');
      return res.json({ ok: true, rating: null, authenticated: false });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      
      const rating = await Rating.findOne({ animeId: String(animeId), userId: String(userId) });
      
      if (!rating) {
        console.log('[Rating GET] No rating found for user');
        return res.json({ ok: true, rating: null, authenticated: true });
      }
      
      console.log('[Rating GET] Rating found:', rating.rating);
      res.json({ ok: true, rating: rating.rating, authenticated: true });
    } catch (jwtError) {
      // Token invalid, return unauthenticated
      console.log('[Rating GET] Invalid token');
      return res.json({ ok: true, rating: null, authenticated: false });
    }
  } catch (e) {
    console.error('[Rating GET Error]', e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Submit or update a user's rating for an anime
app.post('/api/anime/:animeId/rating', async (req, res) => {
  console.log('[Rating POST] Route hit for animeId:', req.params.animeId);
  try {
    const { animeId } = req.params;
    const { rating } = req.body;
    
    // Check authentication
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    
    // Validate rating
    if (typeof rating !== 'number' || rating < 0 || rating > 10) {
      return res.status(400).json({ ok: false, error: 'Rating must be a number between 0 and 10' });
    }
    
    // Find the anime
    const query = /^\d+$/.test(animeId)
      ? { clientId: Number(animeId) }
      : { _id: animeId };
    
    const anime = await Anime.findOne(query);
    if (!anime) {
      return res.status(404).json({ ok: false, error: 'Anime not found' });
    }
    
    // Use the anime's _id for the rating
    const animeIdForRating = anime._id.toString();
    
    // Upsert the rating (create or update)
    const updatedRating = await Rating.findOneAndUpdate(
      { animeId: animeIdForRating, userId: String(userId) },
      { rating: Number(rating) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    // Recalculate the anime's average rating
    const { averageRating, ratingCount } = await anime.recalculateRatings();
    
    console.log('[Rating POST] Rating submitted successfully:', updatedRating.rating);
    res.json({ 
      ok: true, 
      rating: updatedRating.rating,
      averageRating,
      ratingCount
    });
  } catch (e) {
    console.error('[Rating POST Error]', e);
    if (e.name === 'JsonWebTokenError') {
      return res.status(401).json({ ok: false, error: 'Invalid token' });
    }
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Delete a user's rating for an anime
app.delete('/api/anime/:animeId/rating', async (req, res) => {
  console.log('[Rating DELETE] Route hit for animeId:', req.params.animeId);
  try {
    const { animeId } = req.params;
    
    // Check authentication
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    
    // Find the anime
    const query = /^\d+$/.test(animeId)
      ? { clientId: Number(animeId) }
      : { _id: animeId };
    
    const anime = await Anime.findOne(query);
    if (!anime) {
      return res.status(404).json({ ok: false, error: 'Anime not found' });
    }
    
    const animeIdForRating = anime._id.toString();
    
    // Delete the rating
    await Rating.findOneAndDelete({ animeId: animeIdForRating, userId: String(userId) });
    
    // Recalculate the anime's average rating
    const { averageRating, ratingCount } = await anime.recalculateRatings();
    
    console.log('[Rating DELETE] Rating deleted successfully');
    res.json({ 
      ok: true, 
      averageRating,
      ratingCount
    });
  } catch (e) {
    console.error('[Rating DELETE Error]', e);
    if (e.name === 'JsonWebTokenError') {
      return res.status(401).json({ ok: false, error: 'Invalid token' });
    }
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/api/anime', async (req, res) => {
  if (!requireDbForGet({ ok: false, error: 'MongoDB is not connected.' }, res)) return;
  const anime = await Anime.find().sort({ createdAt: -1 }).lean();
  console.log('[GET /api/anime] MongoDB documents count:', anime.length);
  if (anime.length > 0) {
    console.log('[GET /api/anime] First MongoDB document:', JSON.stringify(anime[0], null, 2));
    console.log('[GET /api/anime] First document fields:', {
      status: anime[0]?.status,
      desc: anime[0]?.desc,
      year: anime[0]?.year,
      studio: anime[0]?.studio,
      genres: anime[0]?.genres,
      rating: anime[0]?.rating,
      premium: anime[0]?.premium,
      featured: anime[0]?.featured,
      trending: anime[0]?.trending,
      newEpisode: anime[0]?.newEpisode
    });
  }
  const normalizedAnime = anime.map(normalizeAnime);
  console.log('[GET /api/anime] Returning', anime.length, 'anime records');
  if (normalizedAnime.length > 0) {
    console.log('[GET /api/anime] RESPONSE FIRST ANIME:', JSON.stringify(normalizedAnime[0], null, 2));
    console.log('[GET /api/anime] Sample anime status:', normalizedAnime[0]?.status);
    console.log('[GET /api/anime] Sample anime rating:', normalizedAnime[0]?.rating);
  }
  res.json({ ok: true, anime: normalizedAnime });
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

app.post('/api/anime', requireDb, async (req, res) => { // TEMP: Removed requireActiveUser for debugging
  console.log('[BACKEND CREATE TRACE] ROUTE HIT');
  console.log('[BACKEND CREATE TRACE] METHOD:', req.method);
  console.log('[BACKEND CREATE TRACE] URL:', req.originalUrl);
  console.log('[BACKEND CREATE TRACE] BODY:', JSON.stringify(req.body, null, 2));
  console.log('[CREATE ANIME BACKEND] ===== REQUEST RECEIVED =====');
  console.log('[CREATE ANIME BACKEND] req.body:', JSON.stringify(req.body, null, 2));
  console.log('[CREATE ANIME BACKEND] Frontend sent id:', req.body.id);
  console.log('[CREATE ANIME BACKEND] Frontend sent clientId:', req.body.clientId);
  
  const nextClientId = req.body.clientId || Date.now();
  console.log('[CREATE ANIME BACKEND] Generated nextClientId:', nextClientId);
  console.log('[CREATE ANIME BACKEND] ID mismatch check:', {
    frontendId: req.body.id,
    frontendClientId: req.body.clientId,
    generatedClientId: nextClientId,
    willUse: nextClientId
  });
  
  const animeData = {
    ...req.body,
    clientId: nextClientId,
    genres: normalizeGenreList(req.body.genres),
  };
  
  console.log('[CREATE ANIME BACKEND] DATA BEFORE MONGODB:', JSON.stringify(animeData, null, 2));
  console.log('[CREATE ANIME BACKEND] Fields before MongoDB:', {
    title: animeData.title,
    titleJp: animeData.titleJp,
    desc: animeData.desc,
    year: animeData.year,
    studio: animeData.studio,
    genres: animeData.genres,
    status: animeData.status,
    rating: animeData.rating,
    premium: animeData.premium,
    featured: animeData.featured,
    trending: animeData.trending,
    newEpisode: animeData.newEpisode,
    bannerDisplay: animeData.bannerDisplay
  });
  
  console.log('[CREATE ANIME BACKEND] Schema paths:', Object.keys(Anime.schema.paths));
  console.log('[CREATE ANIME BACKEND] Schema has status field:', 'status' in Anime.schema.paths);
  console.log('[CREATE ANIME BACKEND] Schema has desc field:', 'desc' in Anime.schema.paths);
  console.log('[CREATE ANIME BACKEND] Schema has year field:', 'year' in Anime.schema.paths);
  console.log('[CREATE ANIME BACKEND] Schema has studio field:', 'studio' in Anime.schema.paths);
  console.log('[CREATE ANIME BACKEND] Schema has genres field:', 'genres' in Anime.schema.paths);
  console.log('[CREATE ANIME BACKEND] Schema has rating field:', 'rating' in Anime.schema.paths);
  console.log('[CREATE ANIME BACKEND] Schema has premium field:', 'premium' in Anime.schema.paths);
  console.log('[CREATE ANIME BACKEND] Schema has featured field:', 'featured' in Anime.schema.paths);
  console.log('[CREATE ANIME BACKEND] Schema has trending field:', 'trending' in Anime.schema.paths);
  console.log('[CREATE ANIME BACKEND] Schema has newEpisode field:', 'newEpisode' in Anime.schema.paths);
  console.log('[CREATE ANIME BACKEND] Schema has bannerDisplay field:', 'bannerDisplay' in Anime.schema.paths);
  console.log('[CREATE ANIME BACKEND] Schema has titleJp field:', 'titleJp' in Anime.schema.paths);
  
  const anime = await Anime.create(animeData);
  
  console.log('[CREATE ANIME BACKEND] CREATED DOCUMENT:', JSON.stringify(anime.toObject(), null, 2));
  console.log('[CREATE ANIME BACKEND] SAVED FIELDS:', {
    title: anime.title,
    titleJp: anime.titleJp,
    desc: anime.desc,
    year: anime.year,
    studio: anime.studio,
    genres: anime.genres,
    status: anime.status,
    rating: anime.rating,
    premium: anime.premium,
    featured: anime.featured,
    trending: anime.trending,
    newEpisode: anime.newEpisode,
    bannerDisplay: anime.bannerDisplay
  });
  
  // FRESH MongoDB query to verify what was actually saved
  const freshAnime = await Anime.findById(anime._id).lean();
  console.log('[CREATE ANIME BACKEND] FRESH DOCUMENT FROM MONGODB:', JSON.stringify(freshAnime, null, 2));
  console.log('[CREATE ANIME BACKEND] FRESH FIELDS:', {
    title: freshAnime?.title,
    titleJp: freshAnime?.titleJp,
    desc: freshAnime?.desc,
    year: freshAnime?.year,
    studio: freshAnime?.studio,
    genres: freshAnime?.genres,
    status: freshAnime?.status,
    rating: freshAnime?.rating,
    premium: freshAnime?.premium,
    featured: freshAnime?.featured,
    trending: freshAnime?.trending,
    newEpisode: freshAnime?.newEpisode,
    bannerDisplay: freshAnime?.bannerDisplay
  });
  
  await syncGenreCounts();
  res.status(201).json({ ok: true, anime: normalizeAnime(anime) });
});

// Upsert per-episode media (fixes ep2 overwriting ep1)
app.put('/api/anime/:id/episodes/:episodeNumber', requireDb, requireActiveUser, async (req, res) => {
  console.log('[Episode Creation] Starting episode update/creation...', { id: req.params.id, episodeNumber: req.params.episodeNumber });
  console.log('[Episode Creation] Request body:', req.body);

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
    console.log('[Episode Creation] Updating existing episode:', episodeNumber);
    anime.episodesMedia[idx] = nextEpisode;
  } else {
    console.log('[Episode Creation] Adding new episode:', episodeNumber);
    anime.episodesMedia.push(nextEpisode);
  }

  // Keep numeric hint display value (max episodes)
  anime.episodes = Math.max(Number(anime.episodes || 1), episodeNumber);
  anime.newEpisode = true;
  anime.status = update?.status || 'Airing';

  console.log('[Episode Creation] Saving to database...');
  await anime.save();
  console.log('[Episode Creation] Saved successfully, total episodes:', anime.episodesMedia.length);
  
  res.json({ ok: true, anime: normalizeAnime(anime) });
});

// Delete one episode from a series (anime only)
app.delete('/api/anime/:id/episodes/:episodeNumber', requireDb, requireAdmin, async (req, res) => {
  console.log('[Episode Deletion] Starting episode deletion...', { id: req.params.id, episodeNumber: req.params.episodeNumber });
  
  const query = /^\d+$/.test(req.params.id)
    ? { clientId: Number(req.params.id) }
    : { _id: req.params.id };

  const episodeNumber = Number(req.params.episodeNumber);
  if (!Number.isFinite(episodeNumber) || episodeNumber < 1) {
    console.error('[Episode Deletion] Invalid episode number:', episodeNumber);
    return res.status(400).json({ ok: false, error: 'episodeNumber must be >= 1' });
  }

  const anime = await Anime.findOne(query);
  if (!anime) {
    console.error('[Episode Deletion] Anime not found');
    return res.status(404).json({ ok: false, error: 'Anime not found.' });
  }

  console.log('[Episode Deletion] Current episodes before deletion:', anime.episodesMedia?.length || 0);
  
  anime.episodesMedia = Array.isArray(anime.episodesMedia) ? anime.episodesMedia : [];
  anime.episodesMedia = anime.episodesMedia.filter(e => Number(e?.episodeNumber) !== episodeNumber);

  // Recompute numeric episodes hint (max episode number) but keep at least 1
  const maxEp = anime.episodesMedia.reduce((m, e) => Math.max(m, Number(e?.episodeNumber) || 0), 1);
  anime.episodes = Math.max(Number(maxEp || 1), 1);

  // Keep status/newEpisode stable for UI; don't force newEpisode on delete.
  anime.newEpisode = false;

  console.log('[Episode Deletion] Saving to database...');
  await anime.save();
  console.log('[Episode Deletion] Deleted successfully, remaining episodes:', anime.episodesMedia.length);
  
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
  console.log('[BACKEND CREATE TRACE] ROUTE HIT - PUT');
  console.log('[BACKEND CREATE TRACE] METHOD:', req.method);
  console.log('[BACKEND CREATE TRACE] URL:', req.originalUrl);
  console.log('[BACKEND CREATE TRACE] BODY:', JSON.stringify(req.body, null, 2));
  console.log('[Edit Anime API] PUT request received for anime ID:', req.params.id);
  console.log('[Edit Anime API] Request payload keys:', Object.keys(req.body));
  console.log('[Edit Anime API] Request payload:', JSON.stringify(req.body, null, 2));

  const query = /^\d+$/.test(req.params.id)
    ? { clientId: Number(req.params.id) }
    : { _id: req.params.id };
  
  console.log('[Edit Anime API] Query:', query);
  
  // Get the anime before update to see what we're changing
  const animeBefore = await Anime.findOne(query);
  if (!animeBefore) {
    console.error('[Edit Anime API] Anime not found with query:', query);
    return res.status(404).json({ ok: false, error: 'Anime not found.' });
  }
  
  console.log('[Edit Anime API] Anime before update fields:', Object.keys(animeBefore.toObject()));
  console.log('[Edit Anime API] Anime before update:', JSON.stringify(animeBefore.toObject(), null, 2));
  
  // Build explicit update object with only allowed fields
  const {
    title,
    titleJp,
    desc,
    year,
    studio,
    genres,
    status,
    rating,
    premium,
    featured,
    trending,
    newEpisode,
    image,
    imageMetadata,
    banner,
    bannerMetadata,
    bannerVideo,
    bannerVideoMetadata,
    trailer,
    trailerMetadata,
    movieMedia,
    episodesMedia,
    type,
    episodes,
    introStart,
    introEnd,
    outroStart,
    outroEnd,
    videoUrl,
    videoSources,
    bannerDisplay
  } = req.body;
  
  const updateData = {};
  
  // Only include fields that are actually provided in the request
  if (title !== undefined) updateData.title = title;
  if (titleJp !== undefined) updateData.titleJp = titleJp;
  if (desc !== undefined) updateData.desc = desc;
  if (year !== undefined) updateData.year = year;
  if (studio !== undefined) updateData.studio = studio;
  if (genres !== undefined) {
    updateData.genres = Array.isArray(genres) ? normalizeGenreList(genres) : genres;
  }
  if (status !== undefined) updateData.status = status;
  if (rating !== undefined) updateData.rating = rating;
  if (premium !== undefined) updateData.premium = premium;
  if (featured !== undefined) updateData.featured = featured;
  if (trending !== undefined) updateData.trending = trending;
  if (newEpisode !== undefined) updateData.newEpisode = newEpisode;
  if (image !== undefined) updateData.image = image;
  if (imageMetadata !== undefined) updateData.imageMetadata = imageMetadata;
  if (banner !== undefined) updateData.banner = banner;
  if (bannerMetadata !== undefined) updateData.bannerMetadata = bannerMetadata;
  if (bannerVideo !== undefined) updateData.bannerVideo = bannerVideo;
  if (bannerVideoMetadata !== undefined) updateData.bannerVideoMetadata = bannerVideoMetadata;
  if (trailer !== undefined) updateData.trailer = trailer;
  if (trailerMetadata !== undefined) updateData.trailerMetadata = trailerMetadata;
  if (movieMedia !== undefined) updateData.movieMedia = movieMedia;
  if (episodesMedia !== undefined) updateData.episodesMedia = episodesMedia;
  if (type !== undefined) updateData.type = type;
  if (episodes !== undefined) updateData.episodes = episodes;
  if (introStart !== undefined) updateData.introStart = introStart;
  if (introEnd !== undefined) updateData.introEnd = introEnd;
  if (outroStart !== undefined) updateData.outroStart = outroStart;
  if (outroEnd !== undefined) updateData.outroEnd = outroEnd;
  if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
  if (videoSources !== undefined) updateData.videoSources = videoSources;
  if (bannerDisplay !== undefined) updateData.bannerDisplay = bannerDisplay;
  
  console.log('[Edit Anime API] Explicit updateData:', JSON.stringify(updateData, null, 2));
  
  const anime = await Anime.findOneAndUpdate(
    query,
    { $set: updateData },
    { 
      returnDocument: 'after', 
      upsert: false,
      runValidators: true
    }
  );
  
  console.log('[Edit Anime API] Anime updated successfully:', anime.title);
  console.log('[Edit Anime API] Updated document fields:', Object.keys(anime.toObject()));
  console.log('[Edit Anime API] Status field after update:', anime.status);
  console.log('[Edit Anime API] Rating field after update:', anime.rating);
  console.log('[Edit Anime API] Trending field after update:', anime.trending);
  console.log('[Edit Anime API] New Episode field after update:', anime.newEpisode);
  console.log('[Edit Anime API] Updated document:', JSON.stringify(anime.toObject(), null, 2));
  
  // CRITICAL: Immediately fetch from MongoDB again to verify persistence
  const verifiedAnime = await Anime.findOne(query).lean();
  console.log('[Edit Anime API] VERIFIED FROM MONGODB - Status:', verifiedAnime?.status);
  console.log('[Edit Anime API] VERIFIED FROM MONGODB - Rating:', verifiedAnime?.rating);
  console.log('[Edit Anime API] VERIFIED FROM MONGODB - Trending:', verifiedAnime?.trending);
  console.log('[Edit Anime API] VERIFIED FROM MONGODB - New Episode:', verifiedAnime?.newEpisode);
  console.log('[Edit Anime API] VERIFIED FROM MONGODB - Genres:', verifiedAnime?.genres);
  console.log('[Edit Anime API] VERIFIED FROM MONGODB - Studio:', verifiedAnime?.studio);
  console.log('[Edit Anime API] VERIFIED FROM MONGODB - Desc:', verifiedAnime?.desc);
  console.log('[Edit Anime API] VERIFIED FROM MONGODB - Year:', verifiedAnime?.year);
  console.log('[Edit Anime API] VERIFIED FROM MONGODB - Premium:', verifiedAnime?.premium);
  console.log('[Edit Anime API] VERIFIED FROM MONGODB - Featured:', verifiedAnime?.featured);
  console.log('[Edit Anime API] VERIFIED FROM MONGODB - TitleJp:', verifiedAnime?.titleJp);
  console.log('[Edit Anime API] VERIFIED FROM MONGODB - Full document:', JSON.stringify(verifiedAnime, null, 2));
  
  // Compare before and after
  const beforeFields = Object.keys(animeBefore.toObject());
  const afterFields = Object.keys(anime.toObject());
  const missingFields = beforeFields.filter(f => !afterFields.includes(f));
  const newFields = afterFields.filter(f => !beforeFields.includes(f));
  
  console.log('[Edit Anime API] Field comparison:');
  console.log('[Edit Anime API] Missing fields:', missingFields);
  console.log('[Edit Anime API] New fields:', newFields);
  
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

// --------------- Ratings ---------------
// Get current user's rating for an anime
app.get('/api/anime/:animeId/rating', requireDb, async (req, res) => {
  console.log('[Rating GET] Route hit for animeId:', req.params.animeId);
  try {
    const { animeId } = req.params;
    
    // Check if user is authenticated
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      console.log('[Rating GET] No token provided');
      return res.json({ ok: true, rating: null, authenticated: false });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      
      const rating = await Rating.findOne({ animeId: String(animeId), userId: String(userId) });
      
      if (!rating) {
        console.log('[Rating GET] No rating found for user');
        return res.json({ ok: true, rating: null, authenticated: true });
      }
      
      console.log('[Rating GET] Rating found:', rating.rating);
      res.json({ ok: true, rating: rating.rating, authenticated: true });
    } catch (jwtError) {
      // Token invalid, return unauthenticated
      console.log('[Rating GET] Invalid token');
      return res.json({ ok: true, rating: null, authenticated: false });
    }
  } catch (e) {
    console.error('[Rating GET Error]', e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Submit or update a user's rating for an anime
app.post('/api/anime/:animeId/rating', async (req, res) => {
  console.log('[Rating POST] Route hit for animeId:', req.params.animeId);
  try {
    const { animeId } = req.params;
    const { rating } = req.body;
    
    // Check authentication
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    
    // Validate rating
    if (typeof rating !== 'number' || rating < 0 || rating > 10) {
      return res.status(400).json({ ok: false, error: 'Rating must be a number between 0 and 10' });
    }
    
    // Find the anime
    const query = /^\d+$/.test(animeId)
      ? { clientId: Number(animeId) }
      : { _id: animeId };
    
    const anime = await Anime.findOne(query);
    if (!anime) {
      return res.status(404).json({ ok: false, error: 'Anime not found' });
    }
    
    // Use the anime's _id for the rating
    const animeIdForRating = anime._id.toString();
    
    // Upsert the rating (create or update)
    const updatedRating = await Rating.findOneAndUpdate(
      { animeId: animeIdForRating, userId: String(userId) },
      { rating: Number(rating) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    // Recalculate the anime's average rating
    const { averageRating, ratingCount } = await anime.recalculateRatings();
    
    console.log('[Rating POST] Rating submitted successfully:', updatedRating.rating);
    res.json({ 
      ok: true, 
      rating: updatedRating.rating,
      averageRating,
      ratingCount
    });
  } catch (e) {
    console.error('[Rating POST Error]', e);
    if (e.name === 'JsonWebTokenError') {
      return res.status(401).json({ ok: false, error: 'Invalid token' });
    }
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Delete a user's rating for an anime
app.delete('/api/anime/:animeId/rating', async (req, res) => {
  console.log('[Rating DELETE] Route hit for animeId:', req.params.animeId);
  try {
    const { animeId } = req.params;
    
    // Check authentication
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    
    // Find the anime
    const query = /^\d+$/.test(animeId)
      ? { clientId: Number(animeId) }
      : { _id: animeId };
    
    const anime = await Anime.findOne(query);
    if (!anime) {
      return res.status(404).json({ ok: false, error: 'Anime not found' });
    }
    
    const animeIdForRating = anime._id.toString();
    
    // Delete the rating
    await Rating.findOneAndDelete({ animeId: animeIdForRating, userId: String(userId) });
    
    // Recalculate the anime's average rating
    const { averageRating, ratingCount } = await anime.recalculateRatings();
    
    console.log('[Rating DELETE] Rating deleted successfully');
    res.json({ 
      ok: true, 
      averageRating,
      ratingCount
    });
  } catch (e) {
    console.error('[Rating DELETE Error]', e);
    if (e.name === 'JsonWebTokenError') {
      return res.status(401).json({ ok: false, error: 'Invalid token' });
    }
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/api/users', requireDb, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).select({ passwordHash: 0 }).lean();
  res.json({ ok: true, users });
});

app.get('/api/announcements', requireDb, async (req, res) => {
  const announcements = await Announcement.find({ published: true }).sort({ createdAt: -1 }).limit(20).lean();
  res.json({ ok: true, announcements });
});

app.get('/api/admin/announcements', requireAdmin, requireDb, async (req, res) => {
  const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(100).lean();
  res.json({ ok: true, announcements });
});

app.post('/api/admin/announcements', requireAdmin, requireDb, async (req, res) => {
  try {
    const { title, message, type, actionLabel, actionUrl } = req.body || {};
    if (!String(title || '').trim() || !String(message || '').trim()) return res.status(400).json({ ok: false, error: 'Title and message are required.' });
    const announcement = await Announcement.create({ title, message, type, actionLabel, actionUrl, publishedBy: req.auth.username || 'Admin' });
    res.status(201).json({ ok: true, announcement });
  } catch (error) { res.status(400).json({ ok: false, error: String(error?.message || error) }); }
});

app.delete('/api/admin/announcements/:announcementId', requireAdmin, requireDb, async (req, res) => {
  const deleted = await Announcement.findByIdAndDelete(req.params.announcementId);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Announcement not found.' });
  res.json({ ok: true });
});

app.get('/api/admin/anime/:animeId/rating-summary', requireAdmin, requireDb, async (req, res) => {
  const anime = await Anime.findOne(/^[0-9]+$/.test(req.params.animeId) ? { clientId: Number(req.params.animeId) } : { _id: req.params.animeId }).lean();
  if (!anime) return res.status(404).json({ ok: false, error: 'Anime not found.' });
  const ratings = await Rating.find({ animeId: String(anime._id) }).lean();
  const distribution = [1, 2, 3, 4, 5].map(stars => ({ stars, count: ratings.filter(r => Math.max(1, Math.min(5, Math.ceil(Number(r.rating) / 2))) === stars).length }));
  res.json({ ok: true, averageRating: anime.averageRating || 0, totalRatings: ratings.length, distribution });
});

app.get('/api/admin/banned-users', requireAdmin, requireDb, async (req, res) => {
  try {
    // Expired temporary bans should no longer appear or prevent access.
    await User.updateMany(
      { status: 'Banned', 'banInfo.banEnds': { $ne: null, $lte: new Date() } },
      { $set: { status: 'Active' }, $unset: { banInfo: 1 } }
    );

    const users = await User.find({ status: { $in: ['Banned', 'banned'] } })
      .sort({ 'banInfo.bannedAt': -1 })
      .select({ passwordHash: 0 })
      .lean();
    res.json({ ok: true, users });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

app.get('/api/admin/users/:userId/details', requireAdmin, requireDb, async (req, res) => {
  const user = await User.findById(req.params.userId).select({ passwordHash: 0 }).lean();
  if (!user) return res.status(404).json({ ok: false, error: 'User not found.' });
  const [watchHistory, comments, ratings] = await Promise.all([
    WatchProgress.find({ userId: String(user._id) }).sort({ updatedAt: -1 }).limit(30).lean(),
    Comment.find({ userId: String(user._id) }).sort({ createdAt: -1 }).limit(30).lean(),
    Rating.find({ userId: String(user._id) }).sort({ updatedAt: -1 }).limit(30).lean(),
  ]);
  res.json({ ok: true, user, watchHistory, comments, ratings });
});

app.post('/api/admin/users/:userId/reset-password', requireAdmin, requireDb, async (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 8) return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });
  const passwordHash = await bcrypt.hash(password, 12);
  await User.findByIdAndUpdate(req.params.userId, { $set: { passwordHash, forceLogoutAt: new Date() } });
  res.json({ ok: true });
});

app.post('/api/admin/users/:userId/force-logout', requireAdmin, requireDb, async (req, res) => {
  await User.findByIdAndUpdate(req.params.userId, { $set: { forceLogoutAt: new Date() } });
  res.json({ ok: true });
});

app.delete('/api/admin/users/:userId', requireAdmin, requireDb, async (req, res) => {
  if (String(req.params.userId) === String(req.auth.userId)) return res.status(400).json({ ok: false, error: 'You cannot delete your own admin account.' });
  const target = await User.findById(req.params.userId);
  if (!target) return res.status(404).json({ ok: false, error: 'User not found.' });
  if ((target.roles || []).some(role => ['admin', 'moderator', 'shield'].includes(role))) return res.status(403).json({ ok: false, error: 'Admin accounts cannot be deleted here.' });
  await Promise.all([User.deleteOne({ _id: target._id }), WatchProgress.deleteMany({ userId: String(target._id) }), Comment.deleteMany({ userId: String(target._id) }), Rating.deleteMany({ userId: String(target._id) })]);
  res.json({ ok: true });
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
      const reason = String(banInfo?.reason || 'Violation of Community Guidelines').trim();
      const banEnds = banInfo?.banEnds ? new Date(banInfo.banEnds) : null;
      if (!reason || reason.length > 500) {
        return res.status(400).json({ ok: false, error: 'Ban reason is required and must be 500 characters or fewer.' });
      }
      if (banEnds && (Number.isNaN(banEnds.getTime()) || banEnds <= new Date())) {
        return res.status(400).json({ ok: false, error: 'Temporary-ban expiry must be a future date.' });
      }
      updateData.banInfo = {
        reason,
        bannedAt: new Date(),
        banEnds,
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

  const portNum = parseInt(port);
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
  
  return nodemailer.createTransport({
    host,
    port: portNum,
    secure: portNum === 465, // true for 465 (SSL), false for 587 (TLS)
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: isProduction, // Allow self-signed certs in development only
    },
    // Force IPv4 to avoid IPv6 connection issues
    family: 4,
    // Add connection pooling and retry for production
    pool: isProduction,
    maxConnections: isProduction ? 5 : 1,
    maxMessages: isProduction ? 100 : 10,
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
    console.log('[Register] Registration attempt started');
    const { name, username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ ok: false, error: 'username, email and password are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedUsername = String(username).trim();

    console.log('[Register] Checking for existing email:', normalizedEmail);
    const existingEmail = await User.findOne({ email: normalizedEmail }).catch(e => {
      console.error('Database error checking email:', e);
      throw new Error('Database error occurred');
    });
    if (existingEmail) {
      // Apply defaults for missing fields (for users created before schema update)
      if (existingEmail.isVerified === undefined) existingEmail.isVerified = false;
      if (existingEmail.status === undefined) existingEmail.status = 'pending';
      if (!existingEmail.roles || !Array.isArray(existingEmail.roles)) existingEmail.roles = ['user'];
      return res.status(409).json({ ok: false, error: 'Email already exists.' });
    }

    console.log('[Register] Checking for existing username:', normalizedUsername);
    const existingUser = await User.findOne({ username: normalizedUsername }).catch(e => {
      console.error('Database error checking username:', e);
      throw new Error('Database error occurred');
    });
    if (existingUser) return res.status(409).json({ ok: false, error: 'Username already exists.' });

    // Create user directly without OTP verification
    console.log('[Register] Hashing password');
    const passwordHash = await bcrypt.hash(String(password), 10);
    // For security, registration endpoint should only create users with the 'user' role.
    // Admin creation should be handled by a separate, secure script or internal process.
    console.log('[Register] Creating user in database');
    const user = await User.create({
      name: name || normalizedUsername,
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      avatarId: DEFAULT_AVATAR_ID,
      plan: req.body.plan || 'Free',
      isVerified: true, // Auto-verify users
      status: 'active',
      roles: ['user'],
    }).catch(e => {
      console.error('Database error creating user:', e);
      throw new Error('Failed to create user account');
    });

    console.log('[Register] User created successfully:', user._id);
    res.status(201).json({ ok: true, message: 'Registration successful', userId: String(user._id), email: user.email });
  } catch (e) {
    console.error('[Register Error] Full error:', e);
    console.error('[Register Error] Error name:', e?.name);
    console.error('[Register Error] Error message:', e?.message);
    console.error('[Register Error] Error stack:', e?.stack);
    
    // More specific error messages
    let errorMessage = 'Registration failed';
    if (e?.message) {
      errorMessage = e.message;
    }
    
    res.status(500).json({ 
      ok: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        name: e?.name,
        stack: e?.stack
      } : undefined
    });
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
      
      // If user is already verified, they don't need OTP
      if (user.isVerified) {
        return res.status(400).json({ ok: false, error: 'Email is already verified. You can login directly.' });
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
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

    res.json({ ok: true, user: publicProfile(user) });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post('/api/auth/login', requireDb, async (req, res) => {
  try {
    console.log('[Auth] Login attempt started');
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'email and password are required.' });
    }

    console.log('[Auth] Looking up user:', email);
    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).catch(e => {
      console.error('[Auth] Database error finding user:', e);
      throw new Error('Database error occurred');
    });
    
    if (!user) {
      console.log('[Auth] User not found:', email);
      return res.status(401).json({ ok: false, error: 'Invalid credentials.' });
    }

    // Apply defaults for missing fields (for users created before schema update)
    if (user.isVerified === undefined) user.isVerified = false;
    if (user.status === undefined) user.status = 'pending';
    if (!user.roles || !Array.isArray(user.roles)) user.roles = ['user'];

    console.log('[Auth] User fetched from DB:', {
      email: user.email,
      isVerified: user.isVerified,
      status: user.status,
      roles: user.roles,
      userId: user._id
    });

    console.log('[Auth] Comparing password');
    const ok = await bcrypt.compare(String(password), user.passwordHash).catch(e => {
      console.error('[Auth] Password comparison error:', e);
      throw new Error('Password verification failed');
    });
    
    if (!ok) {
      console.log('[Auth] Invalid password for:', email);
      return res.status(401).json({ ok: false, error: 'Invalid credentials.' });
    }

    // Debug logging
    console.log('[Auth] Password verified successfully:', {
      email: user.email,
      isVerified: user.isVerified,
      status: user.status,
      roles: user.roles
    });

    // Skip email verification check - allow direct login for all users
    const isAdmin = Array.isArray(user.roles) && (user.roles.includes('admin') || user.roles.includes('moderator') || user.roles.includes('shield'));
    console.log('[Auth] isAdmin check result:', isAdmin, 'User roles:', user.roles);
    
    // Check if user has verified their email (skip for admins)
    const isVerifiedByFlag = user.isVerified === true;
    console.log('[Auth] isVerifiedByFlag check result:', isVerifiedByFlag, 'User isVerified:', user.isVerified);
    
    // Auto-verify users who aren't verified yet
    if (!isVerifiedByFlag) {
      console.log('[Auth] Auto-verifying user:', user.email);
      await User.updateOne(
        { _id: user._id },
        { $set: { isVerified: true, status: 'active' } }
      ).catch(e => {
        console.error('[Auth] Failed to auto-verify user:', e);
        // Continue anyway since login should still work
      });
      user.isVerified = true;
      user.status = 'active';
    }

    // Expired temporary bans restore access automatically.
    if (user.status === 'Banned' && user.banInfo?.banEnds && new Date(user.banInfo.banEnds) <= new Date()) {
      await User.updateOne({ _id: user._id }, { $set: { status: 'Active' }, $unset: { banInfo: 1 } });
      user.status = 'Active';
      user.banInfo = undefined;
    }

    // Check if user is banned
    if (user.status === 'Banned') {
      console.log('[Auth] User is banned:', { userId: user._id, username: user.username, banInfo: user.banInfo });
      const payload = { userId: String(user._id), username: user.username, roles: user.roles, status: user.status, isVerified: true };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

      return res.json({
        ok: true,
        token,
        user: publicProfile(user),
        banned: true,
      });
    }

    console.log('[Auth] Generating JWT token');
    
    // Check if JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      console.error('[Auth] JWT_SECRET is not set!');
      return res.status(500).json({ ok: false, error: 'Server configuration error: JWT_SECRET not set' });
    }
    
    const payload = { userId: String(user._id), username: user.username, roles: user.roles, status: user.status || 'active', isVerified: true };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    console.log('[Auth] Login successful:', { email: user.email, userId: user._id });
    res.json({
      ok: true,
      token,
      user: publicProfile(user),
    });
  } catch (e) {
    console.error('[Auth] Login error:', e);
    console.error('[Auth] Error name:', e?.name);
    console.error('[Auth] Error message:', e?.message);
    console.error('[Auth] Error stack:', e?.stack);
    
    res.status(500).json({ 
      ok: false, 
      error: String(e?.message || e),
      details: process.env.NODE_ENV === 'development' ? {
        name: e?.name,
        stack: e?.stack
      } : undefined
    });
  }
});

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Missing token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select({ forceLogoutAt: 1 }).lean();
    if (!user) return res.status(401).json({ ok: false, error: 'User not found' });
    if (user.forceLogoutAt && Number(decoded.iat || 0) <= Math.floor(new Date(user.forceLogoutAt).getTime() / 1000)) {
      return res.status(401).json({ ok: false, error: 'Your session has been ended. Please sign in again.' });
    }
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

      // Expired temporary bans restore access automatically.
      if (user.status === 'Banned' && user.banInfo?.banEnds && new Date(user.banInfo.banEnds) <= new Date()) {
        await User.updateOne({ _id: user._id }, { $set: { status: 'Active' }, $unset: { banInfo: 1 } });
        user.status = 'Active';
        user.banInfo = undefined;
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

function publicProfile(user) {
  return {
    id: String(user._id), username: user.username, name: user.name, email: user.email,
    roles: user.roles, plan: user.plan, status: user.status, isVerified: user.isVerified,
    banInfo: user.banInfo,
    // avatar is retained only as a read-only legacy field for old records.
    avatar: user.avatar || null,
    avatarId: normalizeAvatarId(user.avatarId),
    bio: String(user.bio || '').slice(0, 160),
    profileTheme: normalizeProfileTheme(user.profileTheme),
    pinnedAnimeIds: Array.isArray(user.pinnedAnimeIds) ? user.pinnedAnimeIds.map(String) : [],
  };
}

app.get('/api/profile', requireActiveUser, async (req, res) => {
  res.json({ ok: true, user: publicProfile(req.user) });
});

app.put('/api/profile', requireActiveUser, async (req, res) => {
  const bio = String(req.body?.bio || '').trim();
  const profileTheme = normalizeProfileTheme(req.body?.profileTheme);
  const avatarId = normalizeAvatarId(req.body?.avatarId);
  const requestedTheme = String(req.body?.profileTheme || '').trim().toLowerCase();
  const requestedAvatar = String(req.body?.avatarId || '').trim().toLowerCase();
  const pinnedAnimeIds = Array.isArray(req.body?.pinnedAnimeIds)
    ? [...new Set(req.body.pinnedAnimeIds.map(String).filter(Boolean))].slice(0, 6)
    : [];

  if (bio.length > 160) return res.status(400).json({ ok: false, error: 'Bio must be 160 characters or fewer.' });
  if (requestedTheme && !PROFILE_THEME_IDS.includes(LEGACY_PROFILE_THEME_MAP[requestedTheme] || requestedTheme)) {
    return res.status(400).json({ ok: false, error: 'Invalid profile theme.' });
  }
  if (requestedAvatar && !PROFILE_AVATAR_IDS.includes(requestedAvatar)) {
    return res.status(400).json({ ok: false, error: 'Invalid profile avatar.' });
  }

  const user = await User.findByIdAndUpdate(
    req.auth.userId,
    { $set: { bio, profileTheme, avatarId, pinnedAnimeIds } },
    { new: true, runValidators: true }
  );
  res.json({ ok: true, user: publicProfile(user) });
});

app.get('/api/profile/activity', requireActiveUser, async (req, res) => {
  const userId = String(req.auth.userId);
  const [watching, comments, ratings] = await Promise.all([
    WatchProgress.find({ userId }).sort({ updatedAt: -1 }).limit(10).lean(),
    Comment.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
    Rating.find({ userId }).sort({ updatedAt: -1 }).limit(10).lean(),
  ]);
  const activity = [
    ...watching.map(item => ({ type: 'watched', animeId: item.animeId, episode: item.episode, createdAt: item.updatedAt })),
    ...comments.map(item => ({ type: 'commented', animeId: item.animeId, text: item.text, createdAt: item.createdAt })),
    ...ratings.map(item => ({ type: 'rated', animeId: item.animeId, rating: item.rating, createdAt: item.updatedAt })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 12);
  res.json({ ok: true, activity });
});

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

  // Populate username for each comment
  const commentsWithUsernames = await Promise.all(comments.map(async (comment) => {
    const user = await User.findOne({ _id: comment.userId }).lean();
    return {
      ...comment,
      username: user?.username || user?.name || 'Unknown User',
      avatarId: normalizeAvatarId(user?.avatarId),
    };
  }));

  res.json({ ok: true, comments: commentsWithUsernames });
});

app.post('/api/comments', requireDb, requireActiveUser, async (req, res) => {
  try {
    const { animeId, text, rating } = req.body || {};
    if (!animeId || !text) return res.status(400).json({ ok: false, error: 'animeId and text are required.' });

    const comment = await Comment.create({
      animeId: String(animeId),
      userId: String(req.auth.userId),
      text: String(text),
      rating: rating ? Number(rating) : null,
      likes: 0,
    });

    // Update anime average rating
    if (rating) {
      await updateAnimeRating(String(animeId));
    }

    res.status(201).json({ ok: true, comment });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

async function updateAnimeRating(animeId) {
  try {
    const comments = await Comment.find({ animeId, rating: { $ne: null } }).lean();
    if (comments.length === 0) return;

    const totalRating = comments.reduce((sum, c) => sum + c.rating, 0);
    const averageRating = totalRating / comments.length;

    await Anime.findOneAndUpdate(
      { clientId: Number(animeId) },
      { averageRating: Math.round(averageRating * 10) / 10, ratingCount: comments.length }
    );
  } catch (e) {
    console.error('Error updating anime rating:', e);
  }
}

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
    { upsert: true, returnDocument: 'after' }
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

// ============ DONATION/SUPPORT SYSTEM ============

// Initialize donation payment
app.post('/api/donations/initialize', requireDb, async (req, res) => {
  try {
    const { amount, email } = req.body || {};
    
    // Validate amount
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid amount. Amount must be greater than 0.' });
    }
    
    if (amountNum < 500) {
      return res.status(400).json({ ok: false, error: 'Minimum donation amount is ₦500.' });
    }
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ ok: false, error: 'Valid email is required.' });
    }
    
    const normalizedEmail = String(email).toLowerCase().trim();
    
    // Generate unique reference
    const reference = `ANIFY-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    
    // Create pending donation record
    const donation = await Donation.create({
      email: normalizedEmail,
      amount: amountNum,
      currency: 'NGN',
      reference,
      status: 'pending',
      provider: 'paystack',
      userId: req.auth?.userId || null,
      metadata: {
        initiatedAt: new Date().toISOString()
      }
    });
    
    // Initialize Paystack transaction
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return res.status(500).json({ ok: false, error: 'Payment system not configured. Please contact support.' });
    }
    
    const paystackUrl = 'https://api.paystack.co/transaction/initialize';
    const paystackData = {
      amount: amountNum * 100, // Paystack expects amount in kobo (multiply by 100)
      email: normalizedEmail,
      reference,
      callback_url: `${process.env.BASE_URL || 'http://localhost:3000'}/?support=success&reference=${reference}`,
      metadata: {
        donationId: String(donation._id),
        custom_fields: [
          {
            display_name: 'Donation ID',
            variable_name: 'donation_id',
            value: String(donation._id)
          }
        ]
      }
    };
    
    const paystackResponse = await fetch(paystackUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paystackData)
    });
    
    const paystackResult = await paystackResponse.json();
    
    if (!paystackResult.status) {
      console.error('Paystack initialization failed:', paystackResult);
      await Donation.findByIdAndUpdate(donation._id, { 
        $set: { status: 'failed' } 
      });
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to initialize payment. Please try again.' 
      });
    }
    
    res.json({
      ok: true,
      authorization_url: paystackResult.data.authorization_url,
      reference: paystackResult.data.reference,
      access_code: paystackResult.data.access_code
    });
    
  } catch (error) {
    console.error('Donation initialization error:', error);
    res.status(500).json({ ok: false, error: 'Failed to initialize donation. Please try again.' });
  }
});

// Verify donation (webhook and callback)
app.post('/api/donations/verify', requireDb, async (req, res) => {
  try {
    const { reference, trxref } = req.body || {};
    const ref = reference || trxref;
    
    console.log('[Donation Verify] Verification request received:', { reference, trxref, ref });
    
    if (!ref) {
      console.log('[Donation Verify] No reference provided');
      return res.status(400).json({ ok: false, error: 'Transaction reference is required.' });
    }
    
    // Find donation record
    const donation = await Donation.findOne({ reference: ref });
    if (!donation) {
      console.log('[Donation Verify] Donation not found for reference:', ref);
      return res.status(404).json({ ok: false, error: 'Donation record not found.' });
    }
    
    console.log('[Donation Verify] Donation found:', { id: donation._id, status: donation.status, amount: donation.amount });
    
    // If already verified, return success
    if (donation.status === 'success') {
      console.log('[Donation Verify] Donation already verified');
      return res.json({ ok: true, message: 'Donation already verified', donation });
    }
    
    // Verify with Paystack
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    const verifyUrl = `https://api.paystack.co/transaction/verify/${ref}`;
    
    console.log('[Donation Verify] Verifying with Paystack...');
    const paystackResponse = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`
      }
    });
    
    const paystackResult = await paystackResponse.json();
    console.log('[Donation Verify] Paystack response:', { status: paystackResult.status, dataStatus: paystackResult.data?.status });
    
    if (!paystackResult.status || paystackResult.data.status !== 'success') {
      console.log('[Donation Verify] Payment verification failed');
      await Donation.findByIdAndUpdate(donation._id, { 
        $set: { status: 'failed' } 
      });
      return res.status(400).json({ 
        ok: false, 
        error: 'Payment verification failed or payment was not successful.' 
      });
    }
    
    // Update donation record
    const updatedDonation = await Donation.findByIdAndUpdate(donation._id, {
      $set: {
        status: 'success',
        verifiedAt: new Date(),
        metadata: {
          ...donation.metadata,
          paystackData: paystackResult.data
        }
      }
    }, { new: true });
    
    console.log('[Donation Verify] Donation updated to success');
    
    // Update user supporter status if userId exists
    if (donation.userId) {
      console.log('[Donation Verify] Updating user supporter status for userId:', donation.userId);
      const user = await User.findById(donation.userId);
      if (user) {
        const totalDonated = (user.totalDonated || 0) + donation.amount;
        await User.findByIdAndUpdate(donation.userId, {
          $set: {
            isSupporter: true,
            supporterSince: user.supporterSince || new Date(),
            totalDonated
          }
        });
        console.log('[Donation Verify] User supporter status updated');
      } else {
        console.log('[Donation Verify] User not found for userId:', donation.userId);
      }
    } else {
      console.log('[Donation Verify] No userId associated with donation (guest donation)');
    }
    
    res.json({
      ok: true,
      message: 'Donation verified successfully',
      donation: updatedDonation
    });
    
  } catch (error) {
    console.error('[Donation Verify] Error:', error);
    res.status(500).json({ ok: false, error: 'Failed to verify donation.' });
  }
});

// Get user donation history
app.get('/api/donations/history', requireDb, requireAuth, async (req, res) => {
  try {
    const donations = await Donation.find({ 
      userId: req.auth.userId 
    }).sort({ createdAt: -1 }).limit(20);
    
    res.json({ ok: true, donations });
  } catch (error) {
    console.error('Get donation history error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch donation history.' });
  }
});

// Admin: Get all donations
app.get('/api/admin/donations', requireDb, requireAdmin, async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query || {};
    
    const filter = {};
    if (status) {
      filter.status = status;
    }
    
    const donations = await Donation.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();
    
    const total = await Donation.countDocuments(filter);
    const totalAmount = await Donation.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const thisMonth = await Donation.aggregate([
      { 
        $match: { 
          status: 'success',
          createdAt: { $gte: new Date(new Date().setDate(1)) }
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    res.json({
      ok: true,
      donations,
      total,
      totalAmount: totalAmount[0]?.total || 0,
      thisMonthAmount: thisMonth[0]?.total || 0
    });
  } catch (error) {
    console.error('Get admin donations error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch donations.' });
  }
});

// Admin: Get donation statistics
app.get('/api/admin/donations/stats', requireDb, requireAdmin, async (req, res) => {
  try {
    const totalSupporters = await User.countDocuments({ isSupporter: true });
    const totalDonations = await Donation.countDocuments({ status: 'success' });
    
    const totalAmount = await Donation.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const thisMonth = await Donation.aggregate([
      { 
        $match: { 
          status: 'success',
          createdAt: { $gte: new Date(new Date().setDate(1)) }
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    
    res.json({
      ok: true,
      stats: {
        totalSupporters,
        totalDonations,
        totalAmount: totalAmount[0]?.total || 0,
        thisMonthAmount: thisMonth[0]?.total || 0,
        thisMonthDonations: thisMonth[0]?.count || 0
      }
    });
  } catch (error) {
    console.error('Get donation stats error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch donation statistics.' });
  }
});

// Admin: Manually verify donation
app.post('/api/admin/donations/:donationId/verify', requireDb, requireAdmin, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.donationId);
    if (!donation) {
      return res.status(404).json({ ok: false, error: 'Donation not found.' });
    }
    
    if (donation.status === 'success') {
      return res.status(400).json({ ok: false, error: 'Donation already verified.' });
    }
    
    const updatedDonation = await Donation.findByIdAndUpdate(donation._id, {
      $set: {
        status: 'success',
        verifiedAt: new Date(),
        manuallyVerified: true,
        manuallyVerifiedBy: req.auth.userId,
        manuallyVerifiedAt: new Date()
      }
    }, { new: true });
    
    // Update user supporter status
    if (donation.userId) {
      const user = await User.findById(donation.userId);
      if (user) {
        const totalDonated = (user.totalDonated || 0) + donation.amount;
        await User.findByIdAndUpdate(donation.userId, {
          $set: {
            isSupporter: true,
            supporterSince: user.supporterSince || new Date(),
            totalDonated
          }
        });
      }
    }
    
    res.json({ ok: true, donation: updatedDonation });
  } catch (error) {
    console.error('Manual verification error:', error);
    res.status(500).json({ ok: false, error: 'Failed to manually verify donation.' });
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

// Catch-all route for SPA client-side routing (must be last)
app.use((req, res) => {
  // Skip API routes - let them 404 naturally
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'API endpoint not found' });
  }
  // Serve anify.html for client-side routing
  res.sendFile(path.join(__dirname, 'anify.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`MongoDB: ${dbReady ? 'connected' : hasMongo ? 'connecting...' : 'not configured'}`);
  console.log("Storage: Cloudinary");
});
