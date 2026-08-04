import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  animeId: { 
    type: String, 
    required: true, 
    index: true 
  },
  rating: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 10 
  }
}, { 
  timestamps: true 
});

// Create compound index to ensure one rating per user per anime
ratingSchema.index({ userId: 1, animeId: 1 }, { unique: true });

// Create and export the model
const Rating = mongoose.models.Rating || mongoose.model('Rating', ratingSchema);

export default Rating;
