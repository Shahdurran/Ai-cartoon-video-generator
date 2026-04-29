/**
 * Cloudflare R2 storage service.
 *
 * Wraps @aws-sdk/client-s3 (R2 is S3-compatible). All generated binaries
 * (images, audio, video, SRT) live in R2; Postgres only stores the keys +
 * signed URLs are minted per request.
 *
 * Environment:
 *   R2_ENDPOINT          e.g. https://<accountid>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_BASE_URL   optional; if set, publicUrl(key) returns a CDN URL
 *
 * Key conventions (see plan 1.2):
 *   projects/{projectId}/scenes/{sceneId}/image-{variant}.png
 *   projects/{projectId}/scenes/{sceneId}/voice.mp3
 *   projects/{projectId}/scenes/{sceneId}/video.mp4
 *   projects/{projectId}/subtitles.srt
 *   projects/{projectId}/final.mp4
 *   projects/{projectId}/hooks/{variant}.mp4
 */

const fs = require('fs');
const path = require('path');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_PUBLIC_BASE_URL,
} = process.env;

// Bucket name -- accept both R2_BUCKET_NAME (legacy) and R2_BUCKET (Cloudflare's
// own dashboard naming) so users don't have to maintain two aliases.
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;

// Endpoint -- accept either R2_ENDPOINT (full URL) or R2_ACCOUNT_ID. The
// latter is what Cloudflare shows on the bucket page; we derive the
// canonical S3 endpoint from it.
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : null);

let client = null;

function getClient() {
  if (client) return client;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'R2 is not configured. Set R2_ACCOUNT_ID (or R2_ENDPOINT), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET (or R2_BUCKET_NAME).'
    );
  }
  client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

function bucketName() {
  if (!R2_BUCKET_NAME) {
    throw new Error('R2 bucket is not configured: set R2_BUCKET (or R2_BUCKET_NAME)');
  }
  return R2_BUCKET_NAME;
}

function isConfigured() {
  return !!(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}

async function upload(key, body, contentType) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return { key, bucket: bucketName() };
}

async function uploadFromPath(key, localPath, contentType) {
  const stream = fs.createReadStream(localPath);
  return upload(key, stream, contentType || guessContentType(localPath));
}

async function getSignedDownloadUrl(key, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({ Bucket: bucketName(), Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

async function getSignedUploadUrl(key, contentType, expiresInSeconds = 600) {
  const command = new PutObjectCommand({
    Bucket: bucketName(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

async function del(key) {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: bucketName(), Key: key })
  );
}

async function copy(srcKey, dstKey) {
  const bucket = bucketName();
  await getClient().send(
    new CopyObjectCommand({
      Bucket: bucket,
      // CopySource is `<bucket>/<key>` (URL-encoded) per S3 spec.
      CopySource: encodeURIComponent(`${bucket}/${srcKey}`),
      Key: dstKey,
    })
  );
  return { key: dstKey, bucket };
}

async function exists(key) {
  try {
    await getClient().send(
      new HeadObjectCommand({ Bucket: bucketName(), Key: key })
    );
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

async function listPrefix(prefix) {
  const result = await getClient().send(
    new ListObjectsV2Command({
      Bucket: bucketName(),
      Prefix: prefix,
    })
  );
  return result.Contents || [];
}

async function deletePrefix(prefix) {
  const items = await listPrefix(prefix);
  for (const item of items) {
    if (item.Key) await del(item.Key);
  }
  return items.length;
}

async function downloadToFile(key, localPath) {
  const result = await getClient().send(
    new GetObjectCommand({ Bucket: bucketName(), Key: key })
  );
  await new Promise((resolve, reject) => {
    const stream = result.Body;
    const writer = fs.createWriteStream(localPath);
    stream.pipe(writer);
    stream.on('error', reject);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  return localPath;
}

async function downloadToBuffer(key) {
  const result = await getClient().send(
    new GetObjectCommand({ Bucket: bucketName(), Key: key })
  );
  const chunks = [];
  for await (const chunk of result.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function publicUrl(key) {
  if (!R2_PUBLIC_BASE_URL) return null;
  return `${R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.srt': 'application/x-subrip',
      '.json': 'application/json',
    }[ext] || 'application/octet-stream'
  );
}

// Standard key builders used throughout the pipeline.
const keys = {
  sceneImage: (projectId, sceneId, variant, ext = 'png') =>
    `projects/${projectId}/scenes/${sceneId}/image-${variant}.${ext}`,
  sceneVoice: (projectId, sceneId, ext = 'mp3') =>
    `projects/${projectId}/scenes/${sceneId}/voice.${ext}`,
  sceneVideo: (projectId, sceneId) =>
    `projects/${projectId}/scenes/${sceneId}/video.mp4`,
  subtitles: (projectId) => `projects/${projectId}/subtitles.srt`,
  finalVideo: (projectId) => `projects/${projectId}/final.mp4`,
  hookVideo: (projectId, variantId) =>
    `projects/${projectId}/hooks/${variantId}.mp4`,
  styleThumbnail: (id) => `styles/${id}.png`,
  musicTrack: (name) => `music-library/${name}`,
  customUpload: (projectId, sceneId, filename) =>
    `projects/${projectId}/scenes/${sceneId}/upload-${Date.now()}-${filename}`,
  productReference: (projectId, sceneId, ext = 'png') =>
    `projects/${projectId}/scenes/${sceneId}/product-reference.${ext}`,
};

module.exports = {
  isConfigured,
  upload,
  uploadFromPath,
  copy,
  getSignedUrl: getSignedDownloadUrl,
  getSignedDownloadUrl,
  getSignedUploadUrl,
  delete: del,
  del,
  exists,
  listPrefix,
  deletePrefix,
  downloadToFile,
  downloadToBuffer,
  publicUrl,
  guessContentType,
  keys,
};
