#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import dns from 'node:dns';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import Anime from '../models/Anime.js';
import { uploadToR2 } from '../utils/uploadToR2.js';

dns.setServers(['1.1.1.1', '1.0.0.1']);

function findWindowsFfmpegTool(name) {
  if (process.platform !== 'win32') return name;
  const wingetRoot = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  try {
    const packageDir = fsSync.readdirSync(wingetRoot)
      .find(entry => entry.toLowerCase().startsWith('gyan.ffmpeg.'));
    if (packageDir) {
      const binPath = path.join(wingetRoot, packageDir);
      const versionDir = fsSync.readdirSync(binPath, { withFileTypes: true })
        .find(entry => entry.isDirectory() && entry.name.includes('ffmpeg'));
      const executable = versionDir
        ? path.join(binPath, versionDir.name, 'bin', `${name}.exe`)
        : '';
      if (executable && fsSync.existsSync(executable)) return executable;
    }
  } catch {}
  return name;
}

const FFMPEG = process.env.FFMPEG_PATH || findWindowsFfmpegTool('ffmpeg');
const FFPROBE = process.env.FFPROBE_PATH || findWindowsFfmpegTool('ffprobe');
const LIMIT = Number(process.env.MOBILE_MIGRATION_LIMIT || 0);
const EXECUTE = process.argv.includes('--execute');
const limitIndex = process.argv.indexOf('--limit');
const requestedLimit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : LIMIT;
const maxItems = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : Infinity;
const concurrencyIndex = process.argv.indexOf('--concurrency');
const requestedConcurrency = concurrencyIndex >= 0 ? Number(process.argv[concurrencyIndex + 1]) : 3;
const concurrency = Math.max(1, Math.min(6, Number.isFinite(requestedConcurrency) ? requestedConcurrency : 3));
const tempRoot = path.join(os.tmpdir(), 'anify-mobile-video-migration');

function log(message) {
  console.log(`[mobile-migration] ${message}`);
}

function getQualityEntries(source) {
  if (!source) return [];
  if (source instanceof Map) return [...source.entries()];
  return Object.entries(source);
}

function setQuality(source, quality, value) {
  if (source instanceof Map) source.set(quality, value);
  else source[quality] = value;
}

function isMigrated(url) {
  return typeof url === 'string' && url.includes('/videos/mobile-migrated/');
}

function collectSources(anime) {
  const sources = [];
  const add = (location, quality, url, mimeType) => {
    if (!url || typeof url !== 'string' || isMigrated(url)) return;
    sources.push({ location, quality, url, mimeType });
  };

  for (const episode of anime.episodesMedia || []) {
    for (const language of ['sub', 'dub']) {
      const source = episode?.[language];
      for (const [quality, url] of getQualityEntries(source?.qualities)) {
        const mimeType = source?.mimeTypes instanceof Map
          ? source.mimeTypes.get(quality)
          : source?.mimeTypes?.[quality];
        add({ kind: 'episode', episode, language, source }, quality, url, mimeType);
      }
    }
  }

  const movieQualities = anime.movieMedia?.qualities;
  for (const [quality, url] of getQualityEntries(movieQualities)) {
    add({ kind: 'movie', source: anime.movieMedia }, quality, url, anime.movieMedia?.mimeType);
  }

  return sources;
}

function runFfmpeg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const process = spawn(FFMPEG, [
      '-y', '-i', inputPath,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ], { windowsHide: true });

    let stderr = '';
    process.stderr.on('data', chunk => { stderr += chunk.toString(); });
    process.on('error', reject);
    process.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-1200)}`));
    });
  });
}

function probeVideo(inputPath) {
  return new Promise((resolve, reject) => {
    const process = spawn(FFPROBE, [
      '-v', 'error', '-show_streams', '-show_format', '-of', 'json', inputPath,
    ], { windowsHide: true });

    let stdout = '';
    let stderr = '';
    process.stdout.on('data', chunk => { stdout += chunk.toString(); });
    process.stderr.on('data', chunk => { stderr += chunk.toString(); });
    process.on('error', reject);
    process.on('close', code => {
      if (code !== 0) {
        reject(new Error(`FFprobe exited with code ${code}: ${stderr.slice(-800)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Could not parse FFprobe output: ${error.message}`));
      }
    });
  });
}

function isMobileCompatible(probe) {
  const video = probe.streams?.find(stream => stream.codec_type === 'video');
  const audio = probe.streams?.find(stream => stream.codec_type === 'audio');
  const format = String(probe.format?.format_name || '').split(',');
  return video?.codec_name === 'h264' &&
    (!audio || audio.codec_name === 'aac') &&
    (format.includes('mov') || format.includes('mp4'));
}

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function inspectSource(item) {
  const workDir = path.join(tempRoot, randomUUID());
  const inputPath = path.join(workDir, 'source');
  await fs.mkdir(workDir, { recursive: true });
  try {
    await download(item.url, inputPath);
    return await probeVideo(inputPath);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

async function migrateSource(anime, item, index) {
  const episodeNumber = item.location.episode?.episodeNumber || 1;
  const folder = `videos/mobile-migrated/${anime.clientId || anime._id}/${item.location.kind === 'episode' ? `episode-${episodeNumber}` : 'movie'}`;
  const workDir = path.join(tempRoot, randomUUID());
  const inputPath = path.join(workDir, 'source');
  const outputPath = path.join(workDir, 'mobile.mp4');

  await fs.mkdir(workDir, { recursive: true });
  try {
    log(`${index}: converting ${anime.title} ${item.location.kind} ${item.quality}`);
    await download(item.url, inputPath);
    await runFfmpeg(inputPath, outputPath);
    const buffer = await fs.readFile(outputPath);
    const result = await uploadToR2({
      buffer,
      originalname: `${anime.clientId || anime._id}-${episodeNumber}-${item.quality}-mobile.mp4`,
      size: buffer.length,
      mimetype: 'video/mp4',
    }, folder, { metadata: { animeId: anime.clientId || anime._id, episodeNumber } });

    if (item.location.kind === 'episode') {
      if (!item.location.source.mimeTypes) item.location.source.mimeTypes = {};
      setQuality(item.location.source.qualities, item.quality, result.url);
      setQuality(item.location.source.mimeTypes, item.quality, 'video/mp4');
    } else {
      setQuality(item.location.source.qualities, item.quality, result.url);
      item.location.source.mimeType = 'video/mp4';
    }
    await anime.save();
    log(`${index}: database updated; original retained`);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

async function processAnimeGroup(anime, sharedState) {
  for (const item of collectSources(anime)) {
    if (sharedState.processed >= maxItems) return;

    const probe = await inspectSource(item);
    if (isMobileCompatible(probe)) {
      log(`skip: ${anime.title} ${item.location.kind} ${item.quality} is already mobile-compatible`);
      continue;
    }

    if (sharedState.processed >= maxItems) return;
    sharedState.processed += 1;
    const video = probe.streams?.find(stream => stream.codec_type === 'video')?.codec_name || 'unknown';
    const audio = probe.streams?.find(stream => stream.codec_type === 'audio')?.codec_name || 'none';
    if (!EXECUTE) {
      log(`${sharedState.processed}: NEEDS CONVERSION ${anime.title} -> ${item.location.kind} ${item.quality} (video: ${video}, audio: ${audio})`);
      continue;
    }
    await migrateSource(anime, item, sharedState.processed);
  }
}

async function main() {
  if (!EXECUTE) {
    log('DRY RUN: no files will be downloaded, uploaded, or changed. Use --execute to migrate.');
  }
  await fs.mkdir(tempRoot, { recursive: true });
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const sharedState = { processed: 0 };
  try {
    const animeList = await Anime.find();
    let nextAnimeIndex = 0;
    async function worker() {
      while (nextAnimeIndex < animeList.length && sharedState.processed < maxItems) {
        const anime = animeList[nextAnimeIndex++];
        await processAnimeGroup(anime, sharedState);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, animeList.length) }, worker));
    log(`Finished. Sources needing migration: ${sharedState.processed}. Concurrency: ${concurrency}. Originals were not deleted.`);
  } finally {
    await mongoose.disconnect();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error('[mobile-migration] FAILED:', error.message);
  process.exitCode = 1;
});
