import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';

dns.setServers(['1.1.1.1', '1.0.0.1']);

if (!process.env.MONGODB_URI) {
  throw new Error('Missing MONGODB_URI in .env');
}

try {
  await mongoose.connect(process.env.MONGODB_URI);

  const users = mongoose.connection.collection('users');
  const otps = mongoose.connection.collection('otps');
  const pendingOtps = await otps.find({ expiresAt: { $gt: new Date() } }).toArray();
  let migrated = 0;

  for (const otp of pendingOtps) {
    const result = await users.updateOne(
      { email: String(otp.email).toLowerCase().trim(), isVerified: { $ne: true } },
      {
        $set: {
          emailVerification: {
            code: otp.code,
            expiresAt: otp.expiresAt,
            attempts: otp.attempts || 0,
            maxAttempts: otp.maxAttempts || 5,
            lastResendAt: otp.lastResendAt || otp.updatedAt || new Date(),
          },
          updatedAt: new Date(),
        },
      }
    );
    migrated += result.modifiedCount;
  }

  console.log(`OTP migration complete. Pending OTPs found: ${pendingOtps.length}; user records updated: ${migrated}.`);
} finally {
  await mongoose.disconnect();
}
