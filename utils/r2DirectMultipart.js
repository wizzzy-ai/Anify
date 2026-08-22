import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import r2Client from '../config/r2.js';

const PART_SIZE = 50 * 1024 * 1024;
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

function publicUrl(key) {
  const base = String(process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('R2_PUBLIC_URL is not configured.');
  return `${base}/${key}`;
}

function safeFileName(name) {
  return String(name || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function createDirectMultipartUpload({ animeId, season = 1, episodeNumber, filename, mimeType, size }) {
  if (!Number.isFinite(Number(episodeNumber)) || Number(episodeNumber) < 1) throw new Error('A valid episode number is required.');
  if (!Number.isFinite(Number(size)) || Number(size) <= 0 || Number(size) > MAX_FILE_SIZE) throw new Error('Video size must be between 1 byte and 5 GB.');
  if (!String(mimeType || '').startsWith('video/')) throw new Error('Only video files can be uploaded.');

  const key = `videos/anime/${encodeURIComponent(String(animeId))}/season-${Number(season) || 1}/episode-${Number(episodeNumber)}-${Date.now()}-${safeFileName(filename)}`;
  const response = await r2Client.send(new CreateMultipartUploadCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: mimeType,
  }));

  return { key, uploadId: response.UploadId, partSize: PART_SIZE, url: publicUrl(key) };
}

export async function listDirectMultipartParts({ key, uploadId }) {
  const response = await r2Client.send(new ListPartsCommand({ Bucket: process.env.R2_BUCKET, Key: key, UploadId: uploadId }));
  return (response.Parts || []).map((part) => ({ partNumber: part.PartNumber, etag: part.ETag, size: part.Size }));
}

export async function signDirectMultipartPart({ key, uploadId, partNumber, mimeType }) {
  const command = new UploadPartCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: Number(partNumber),
    ContentType: mimeType,
  });
  return getSignedUrl(r2Client, command, { expiresIn: 15 * 60 });
}

export async function completeDirectMultipartUpload({ key, uploadId, parts }) {
  const validParts = (Array.isArray(parts) ? parts : []).filter((part) => Number(part?.partNumber) > 0 && part?.etag);
  if (validParts.length === 0) throw new Error('No uploaded parts were supplied. Retry the episode so R2 can record its upload parts.');
  await r2Client.send(new CompleteMultipartUploadCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: validParts.map((part) => ({ PartNumber: Number(part.partNumber), ETag: part.etag })).sort((a, b) => a.PartNumber - b.PartNumber) },
  }));
  return { key, url: publicUrl(key) };
}

export async function abortDirectMultipartUpload({ key, uploadId }) {
  await r2Client.send(new AbortMultipartUploadCommand({ Bucket: process.env.R2_BUCKET, Key: key, UploadId: uploadId }));
}
