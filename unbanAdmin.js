import dotenv from "dotenv";
dotenv.config();

import mongoose from 'mongoose';

import User from './User.js';

async function unbanAdmins() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all banned users with admin roles
    const bannedAdmins = await User.find({
      status: 'Banned',
      roles: { $in: ['admin', 'moderator', 'shield'] }
    });

    console.log(`Found ${bannedAdmins.length} banned admin users:`);
    
    for (const admin of bannedAdmins) {
      console.log(`- ${admin.username} (${admin.email}) - Status: ${admin.status}`);
      
      // Unban the admin
      await User.findByIdAndUpdate(admin._id, {
        status: 'Active',
        $unset: { banInfo: 1 }
      });
      
      console.log(`  ✓ Unbanned ${admin.username}`);
    }

    if (bannedAdmins.length === 0) {
      console.log('No banned admin users found.');
    }

    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

unbanAdmins();
