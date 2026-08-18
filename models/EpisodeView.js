import mongoose from 'mongoose';

// EpisodeView schema (records qualifying view events for analytics & anti-spam cooldown)
const episodeViewSchema = new mongoose.Schema({
  animeId: { type: String, required: true, index: true },
  animeTitle: { type: String, default: '' },
  episodeNumber: { type: Number, required: true, index: true },
  userId: { type: String, default: null, index: true },
  viewerKey: { type: String, required: true, index: true },
  country: { type: String, default: 'Unknown' },
  viewedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

// Compound indexes for rapid cooldown lookup and aggregated analytics
episodeViewSchema.index({ viewerKey: 1, animeId: 1, episodeNumber: 1, viewedAt: -1 });
episodeViewSchema.index({ viewedAt: -1 });
episodeViewSchema.index({ animeId: 1, episodeNumber: 1, viewedAt: -1 });

const EpisodeView = mongoose.models.EpisodeView || mongoose.model('EpisodeView', episodeViewSchema);

export default EpisodeView;
