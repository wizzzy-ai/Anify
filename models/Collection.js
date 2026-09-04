import mongoose from 'mongoose';

const collectionSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  slug: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  description: { 
    type: String, 
    default: '' 
  },
  type: { 
    type: String, 
    enum: ['manual', 'auto', 'system'],
    default: 'manual'
  },
  // For manual collections: ordered list of anime IDs
  animeIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Anime' 
  }],
  // For auto collections: filter criteria
  autoCriteria: {
    status: String,
    type: String,
    featured: Boolean,
    premium: Boolean,
    trending: Boolean,
    minRating: Number,
    genres: [String]
  },
  // Display settings
  displayOrder: { 
    type: Number, 
    default: 0 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  // System collections are predefined and cannot be deleted
  isSystem: { 
    type: Boolean, 
    default: false 
  }
}, { 
  timestamps: true 
});

// Index for efficient querying
collectionSchema.index({ isActive: 1, displayOrder: 1 });
collectionSchema.index({ type: 1, isActive: 1 });

const Collection = mongoose.models.Collection || mongoose.model('Collection', collectionSchema);

export default Collection;
