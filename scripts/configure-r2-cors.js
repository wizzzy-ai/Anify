import { GetBucketCorsCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import r2Client from '../config/r2.js';

const origins = ['http://localhost:3000', 'https://anify-jljl.onrender.com'];
const requiredRule = {
  AllowedOrigins: origins,
  AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
  AllowedHeaders: ['Content-Type', 'x-amz-*'],
  ExposeHeaders: ['ETag'],
  MaxAgeSeconds: 3600,
};

if (!process.env.R2_BUCKET) throw new Error('R2_BUCKET is not configured in .env.');

let current = [];
try {
  current = (await r2Client.send(new GetBucketCorsCommand({ Bucket: process.env.R2_BUCKET }))).CORSRules || [];
} catch (error) {
  // R2 returns an error when no CORS configuration exists; other errors should stop the script.
  if (!/cors|not.?found|nosuch/i.test(String(error?.name || '') + String(error?.message || ''))) throw error;
}

const exists = current.some((rule) => origins.every((origin) => (rule.AllowedOrigins || []).includes(origin))
  && (rule.AllowedMethods || []).includes('PUT') && (rule.ExposeHeaders || []).includes('ETag'));

if (!exists) {
  await r2Client.send(new PutBucketCorsCommand({ Bucket: process.env.R2_BUCKET, CORSConfiguration: { CORSRules: [...current, requiredRule] } }));
  console.log('✅ R2 CORS updated for:', origins.join(', '));
} else {
  console.log('✅ R2 CORS already contains the required direct-upload rule.');
}
