import 'dotenv/config';
import mongoose from 'mongoose';
import User from './User.js';
import dns from 'node:dns';

// Match the DNS configuration used by the application. This avoids SRV lookup
// failures with some local networks when connecting to MongoDB Atlas.
dns.setServers(['1.1.1.1', '1.0.0.1']);

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env');
  process.exit(1);
}

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

    const adminEmail = 'Anify@gmail.com';
    const normalizedEmail = adminEmail.toLowerCase().trim();
    
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      console.log(`No user found with email: ${adminEmail}. Creating new admin user...`);
      
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('Anify@12345', 10);
      const adminUsername = normalizedEmail.split('@')[0];

      await User.create({
        name: 'Anify Admin',
        username: adminUsername,
        email: normalizedEmail,
        passwordHash,
        plan: 'Free',
        isVerified: true,
        status: 'active',
        roles: ['admin'],
      });
      
      console.log(`Created admin user: ${normalizedEmail}`);
    } else {
      console.log(`Found existing user: ${normalizedEmail}`);
      console.log('Current state:');
      console.log('- Roles:', user.roles);
      console.log('- isVerified:', user.isVerified);
      console.log('- Status:', user.status);
      
      // Update every required field explicitly. The same account must then be
      // read back from this database before reporting success.
      await User.updateOne(
        { _id: user._id },
        { $set: { roles: ['admin'], isVerified: true, status: 'active' } }
      );

      const updatedUser = await User.findById(user._id);
      if (!updatedUser || !updatedUser.roles.includes('admin') || !updatedUser.isVerified || updatedUser.status !== 'active') {
        throw new Error('Admin settings did not persist. Check that MONGODB_URI points to the same database as the server.');
      }
      
      console.log('Updated admin user to:');
      console.log('- Roles:', updatedUser.roles);
      console.log('- isVerified:', updatedUser.isVerified);
      console.log('- Status:', updatedUser.status);
    }

    console.log('\nAdmin user is now configured correctly. You should be able to login without OTP.');

  } catch (e) {
    console.error('Error:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

await main();
