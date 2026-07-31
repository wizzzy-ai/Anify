import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import User from './User.js';

// Keep Atlas DNS behavior consistent with the application server.
dns.setServers(['1.1.1.1', '1.0.0.1']);

if (!process.env.MONGODB_URI) {
  throw new Error('Missing MONGODB_URI in .env');
}

try {
  await mongoose.connect(process.env.MONGODB_URI);

  const result = await User.collection.updateMany(
    {
      $or: [
        { isVerified: { $exists: false } },
        { status: { $exists: false } },
        { roles: { $exists: false } }
      ]
    },
    [
      {
        $set: {
          isVerified: { $ifNull: ['$isVerified', false] },
          status: { $ifNull: ['$status', 'pending'] },
          roles: { $ifNull: ['$roles', ['user']] },
          updatedAt: new Date()
        }
      }
    ]
  );

  console.log(`User schema migration complete. Matched: ${result.matchedCount}; updated: ${result.modifiedCount}.`);
} finally {
  await mongoose.disconnect();
}
