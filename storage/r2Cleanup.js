import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import r2Client from '../config/r2.js';
import Anime from '../models/Anime.js';

function mapValues(value) {
  if (!value) return {};
  return value instanceof Map ? Object.fromEntries(value) : value;
}

function trustedR2Key(value) {
  if (typeof value !== 'string' || !value.trim() || !process.env.R2_PUBLIC_URL) return null;
  try {
    const base = new URL(process.env.R2_PUBLIC_URL);
    const candidate = new URL(value);
    if (candidate.origin !== base.origin) return null;
    const basePath = base.pathname.replace(/\/+$/, '');
    if (basePath && !candidate.pathname.startsWith(`${basePath}/`)) return null;
    const key = decodeURIComponent(basePath
      ? candidate.pathname.slice(basePath.length + 1)
      : candidate.pathname.replace(/^\/+/, ''));
    return key && !key.includes('..') && !key.startsWith('/') ? key : null;
  } catch {
    return null;
  }
}

function publicR2Url(key) {
  const base = String(process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  return base ? `${base}/${key.split('/').map(encodeURIComponent).join('/')}` : null;
}

function collectReferencedKeys(animes) {
  const keys = new Set();
  const addUrl = (url) => {
    const key = trustedR2Key(url);
    if (key) keys.add(key);
  };
  const addSource = (source) => {
    const qualities = mapValues(source?.qualities);
    const storedKeys = mapValues(source?.keys);
    Object.entries(qualities).forEach(([quality, url]) => {
      if (storedKeys[quality]) keys.add(String(storedKeys[quality]));
      else addUrl(url);
    });
  };

  for (const anime of animes) {
    addUrl(anime.trailer);
    addUrl(anime.bannerVideo);
    addUrl(anime.videoUrl);
    addSource(anime.videoSources?.sub);
    addSource(anime.videoSources?.dub);
    for (const metadata of [anime.trailerMetadata, anime.bannerVideoMetadata]) {
      if (metadata?.storageProvider === 'r2' && metadata.storageKey) keys.add(String(metadata.storageKey));
      else addUrl(metadata?.url);
    }
    addSource(anime.movieMedia);
    for (const episode of anime.episodesMedia || []) {
      addSource(episode.sub);
      addSource(episode.dub);
      for (const metadata of Object.values(mapValues(episode.videoMetadata))) {
        if (metadata?.storageProvider === 'r2' && metadata.key) keys.add(String(metadata.key));
        else addUrl(metadata?.url);
      }
    }
  }
  return keys;
}

function episodeHasSavedVideo(episode) {
  return ['sub', 'dub'].some(language => Object.keys(mapValues(episode?.[language]?.qualities)).some(quality => Boolean(episode[language].qualities instanceof Map ? episode[language].qualities.get(quality) : episode[language].qualities[quality])));
}

async function listVideoObjects() {
  const objects = [];
  let continuationToken;
  do {
    const result = await r2Client.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET,
      Prefix: 'videos/',
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));
    objects.push(...(result.Contents || []));
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

export async function scanR2Cleanup() {
  const [animes, objects] = await Promise.all([Anime.find().lean(), listVideoObjects()]);
  const referenced = collectReferencedKeys(animes);
  const animeById = new Map(animes.flatMap(anime => [
    [String(anime.clientId), anime.title],
    [String(anime._id), anime.title],
  ]));
  const orphaned = objects
    .filter(object => object.Key && !referenced.has(object.Key))
    .map(object => {
      const match = String(object.Key).match(/^videos\/anime\/([^/]+)\/season-(\d+)\/episode-(\d+)-/i);
      const matchedAnime = match ? animes.find(anime => String(anime.clientId) === String(match[1]) || String(anime._id) === String(match[1])) : null;
      const matchedEpisode = matchedAnime?.episodesMedia?.find(episode => Number(episode.episodeNumber) === Number(match?.[3]));
      return {
        key: object.Key,
        url: publicR2Url(object.Key),
        size: object.Size || 0,
        lastModified: object.LastModified || null,
        possibleMatch: match ? {
          animeId: match[1],
          animeTitle: animeById.get(String(match[1])) || 'Unknown anime',
          season: Number(match[2]),
          episode: Number(match[3]),
          superseded: Boolean(matchedEpisode && episodeHasSavedVideo(matchedEpisode)),
        } : null,
      };
    });
  return {
    scanned: objects.length,
    referenced: referenced.size,
    orphaned,
    orphanedBytes: orphaned.reduce((total, object) => total + object.size, 0),
  };
}

export async function deleteR2Orphans(keys) {
  const requested = [...new Set((Array.isArray(keys) ? keys : []).filter(key => typeof key === 'string' && key.startsWith('videos/')))].slice(0, 500);
  if (!requested.length) return { deleted: 0, skipped: 0 };
  const report = await scanR2Cleanup();
  const orphaned = new Set(report.orphaned.map(object => object.key));
  const deletable = requested.filter(key => orphaned.has(key));
  for (const key of deletable) {
    await r2Client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
  }
  return { deleted: deletable.length, skipped: requested.length - deletable.length };
}

export async function findR2DuplicateByFingerprint(fingerprint) {
  if (!fingerprint) return null;
  const objects = await listVideoObjects();
  for (const object of objects) {
    if (!object.Key) continue;
    try {
      const head = await r2Client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: object.Key }));
      if (head.Metadata?.['source-sha256'] === fingerprint) {
        return { key: object.Key, size: head.ContentLength || object.Size || 0, lastModified: object.LastModified || object.LastModified || null };
      }
    } catch {
      // A disappearing object should not block an upload or cleanup scan.
    }
  }
  return null;
}
