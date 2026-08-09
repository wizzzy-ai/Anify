import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  type: { type: String, enum: ['announcement', 'new_episode', 'new_anime', 'maintenance'], default: 'announcement' },
  actionLabel: { type: String, trim: true, maxlength: 60, default: '' },
  actionUrl: { type: String, trim: true, maxlength: 500, default: '' },
  publishedBy: { type: String, default: 'Admin' },
  published: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
