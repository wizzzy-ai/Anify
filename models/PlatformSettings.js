import mongoose from 'mongoose';

// A single document holds site-wide switches. Keeping it in MongoDB means a
// maintenance change survives server restarts and works across deployments.
const platformSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'platform' },
  maintenanceMode: { type: Boolean, default: false },
  supportEnabled: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.models.PlatformSettings
  || mongoose.model('PlatformSettings', platformSettingsSchema);
