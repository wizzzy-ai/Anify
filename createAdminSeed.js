import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from './User.js';
import dns from 'node:dns';

// Force Node.js to use a reliable public DNS resolver
dns.setServers(["1.1.1.1", "1.0.0.1"]);

// Load env
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env');
  process.exit(1);
}

const ADMIN_EMAIL = 'Anify@gmail.com';
const ADMIN_PASSWORD = 'Anify@12345';
const ADMIN_ROLES = ['admin'];

function normalizeEmail(email) {
  return String(email).toLowerCase().trim();
}

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');

    const normalizedEmail = normalizeEmail(ADMIN_EMAIL);
    const existing = await User.findOne({ email: normalizedEmail }).lean();

    if (existing) {
      console.log(`[Admin seed] Admin already exists for email: ${normalizedEmail}`);
      return;
    }

    const passwordHash = await bcrypt.hash(String(ADMIN_PASSWORD), 10);

    // Username should be unique-ish; if your system doesn’t require it for admin, keep it simple.
    const adminUsername = normalizedEmail.split('@')[0];

    await User.create({
      name: 'Anify Admin',
      username: adminUsername,
      email: normalizedEmail,
      passwordHash,
      plan: 'Free',
      isVerified: true,
      status: 'active',
      roles: ADMIN_ROLES,
    });

    console.log(`[Admin seed] Created admin user: ${normalizedEmail} with roles=${JSON.stringify(ADMIN_ROLES)}`);
  } catch (e) {
    console.error('[Admin seed] Failed:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

await main();
