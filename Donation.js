import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'NGN' },
  reference: { type: String, required: true, unique: true, index: true },
  status: { 
    type: String, 
    enum: ['pending', 'success', 'failed', 'abandoned'],
    default: 'pending'
  },
  provider: { type: String, default: 'paystack' },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: { type: Date, default: Date.now },
  verifiedAt: { type: Date },
  manuallyVerified: { type: Boolean, default: false },
  manuallyVerifiedBy: { type: String },
  manuallyVerifiedAt: { type: Date }
}, { timestamps: true });

const Donation = mongoose.models.Donation || mongoose.model('Donation', donationSchema);

export default Donation;