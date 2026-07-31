import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'node:dns';

// Force Node.js to use a reliable public DNS resolver
dns.setServers(["1.1.1.1", "1.0.0.1"]);
import User from './User.js';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env');
  process.exit(1);
}

const ADMIN_EMAIL = 'Anify@gmail.com';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');

    const normalizedEmail = ADMIN_EMAIL.toLowerCase().trim();
    
    console.log(`Searching for admin user with email: ${normalizedEmail}`);
    const result = await User.deleteMany({ email: normalizedEmail });

    if (result.deletedCount > 0) {
      console.log(`[Admin seed] Successfully deleted admin user: ${normalizedEmail}`);
    } else {
      console.log(`[Admin seed] No admin user found with email: ${normalizedEmail}. Nothing to delete.`);
    }

  } catch (e) {
    console.error('[Admin seed] Deletion failed:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
    console.log('MongoDB disconnected');
  }
}

await main();