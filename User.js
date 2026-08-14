import mongoose from 'mongoose';

const imageMetadataSchema = new mongoose.Schema({
    storageProvider: { type: String, enum: ['cloudinary'], default: 'cloudinary' },
    publicId: String,
    width: Number,
    height: Number,
    format: String,
    bytes: Number,
    uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const emailVerificationSchema = new mongoose.Schema({
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lastResendAt: { type: Date, default: Date.now },
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: { type: String, trim: true },
    username: { type: String, trim: true, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Built-in profile avatar id. Legacy uploaded avatar fields remain read-only for old records.
    avatarId: { type: String, default: 'shadow', trim: true },
    avatar: String,
    avatarMetadata: { type: imageMetadataSchema, default: null },
    bio: { type: String, trim: true, maxlength: 160, default: '' },
    profileTheme: {
        type: String,
        enum: [
            'default', 'crimson', 'ocean', 'sakura', 'emerald', 'violet', 'azure', 'sunset', 'ice', 'cyber', 'royal',
            'blush', 'peony', 'fuchsia', 'berry', 'coral', 'ash-plum', 'pink', 'obsidian', 'red', 'cobalt-sand', 'ink-peach', 'khaki-violet', 'rosewood-sage-navy', 'cotton-candy', 'rose-gold',
        ],
        default: 'default',
    },
    pinnedAnimeIds: { type: [String], default: [] },
    plan: { type: String, default: 'Free' },
    // These fields control access to the application. They are required for
    // every new account and receive safe defaults during registration.
    isVerified: { type: Boolean, required: true, default: false },
    status: {
        type: String,
        required: true,
        default: 'pending',
        enum: ['pending', 'active', 'suspended', 'deleted', 'Banned']
    },
    roles: { type: [String], required: true, default: ['user'] },
    forceLogoutAt: { type: Date, default: null },
    // Present only while a user must verify their email. It is removed as soon
    // as verification succeeds, so one user document owns its OTP lifecycle.
    emailVerification: { type: emailVerificationSchema, default: null },
    banInfo: {
        reason: { type: String, default: '' },
        bannedAt: { type: Date },
        banEnds: { type: Date },
        bannedBy: { type: String },
    },
    isSupporter: { type: Boolean, default: false },
    supporterSince: { type: Date },
    totalDonated: { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
