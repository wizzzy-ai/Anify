import mongoose from 'mongoose';

// Video metadata schema (for videos: trailers, banner videos, episode sources)
const videoMetadataSchema = new mongoose.Schema({
  storageProvider: { type: String, enum: ['r2', 'cloudinary'], default: 'r2' },
  storageKey: String,
  publicId: String,
  fileSize: Number,
  duration: Number,
  resolution: String,
  mimeType: String,
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

// Image metadata schema (for images: thumbnails, banners, posters)
const imageMetadataSchema = new mongoose.Schema({
  storageProvider: { type: String, enum: ['cloudinary'], default: 'cloudinary' },
  publicId: String,
  width: Number,
  height: Number,
  format: String,
  bytes: Number,
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

// Episode source schema (sub/dub qualities)
const episodeSourceSchema = new mongoose.Schema({
  qualities: { type: Map, of: String, default: {} },
}, { _id: false });

// Episode schema (per-episode data)
const episodeSchema = new mongoose.Schema({
  episodeNumber: { type: Number, required: true, index: true },
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

// Main Anime schema
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
  averageRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
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

// Create and export the model
const Anime = mongoose.models.Anime || mongoose.model('Anime', animeSchema);

export default Anime;
