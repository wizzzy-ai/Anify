import dotenv from "dotenv";
dotenv.config();

import mongoose from 'mongoose';
import Anime from './models/Anime.js';

async function checkMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find the newly created Zootopia 2
    const newAnime = await Anime.findOne({ title: 'Zootopia 2' }).sort({ createdAt: -1 }).lean();
    console.log('\n=== NEWLY CREATED ZOOTOPIA 2 ===');
    console.log('Fields in MongoDB:', Object.keys(newAnime));
    console.log('\nSpecific fields:');
    console.log('status:', newAnime?.status);
    console.log('desc:', newAnime?.desc);
    console.log('year:', newAnime?.year);
    console.log('studio:', newAnime?.studio);
    console.log('genres:', newAnime?.genres);
    console.log('rating:', newAnime?.rating);
    console.log('premium:', newAnime?.premium);
    console.log('featured:', newAnime?.featured);
    console.log('trending:', newAnime?.trending);
    console.log('newEpisode:', newAnime?.newEpisode);
    console.log('bannerDisplay:', newAnime?.bannerDisplay);
    console.log('titleJp:', newAnime?.titleJp);
    console.log('\nFull document:', JSON.stringify(newAnime, null, 2));
    
    // Compare with an older anime that has the fields
    const oldAnime = await Anime.findOne({ clientId: 6 }).lean();
    console.log('\n=== OLDER ANIME (clientId: 6) ===');
    console.log('Fields in MongoDB:', Object.keys(oldAnime));
    console.log('\nSpecific fields:');
    console.log('status:', oldAnime?.status);
    console.log('desc:', oldAnime?.desc);
    console.log('year:', oldAnime?.year);
    console.log('studio:', oldAnime?.studio);
    console.log('genres:', oldAnime?.genres);
    console.log('rating:', oldAnime?.rating);
    console.log('premium:', oldAnime?.premium);
    console.log('featured:', oldAnime?.featured);
    console.log('trending:', oldAnime?.trending);
    console.log('newEpisode:', oldAnime?.newEpisode);
    console.log('bannerDisplay:', oldAnime?.bannerDisplay);
    console.log('titleJp:', oldAnime?.titleJp);
    
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkMongoDB();
