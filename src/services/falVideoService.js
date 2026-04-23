/**
 * Fal.AI video service -- Seedance image-to-video.
 *
 * Wraps the submit / poll / result pattern from @fal-ai/client so the queue
 * processor stays clean, and isolates the VIDEO_MODEL_ID env var so swapping
 * to Seedance 2.0 / Kling is a one-line config change.
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs-extra');

let fal;
try {
  ({ fal } = require('@fal-ai/client'));
} catch (err) {
  console.warn('⚠️  @fal-ai/client not installed -- Seedance will fail until npm install');
}

const DEFAULT_MODEL = process.env.VIDEO_MODEL_ID || 'fal-ai/bytedance/seedance/v1/pro/image-to-video';

function configureFal() {
  if (!fal) throw new Error('@fal-ai/client not available');
  const apiKey = process.env.FAL_KEY || process.env.FAL_AI_API_KEY;
  if (!apiKey) throw new Error('FAL_KEY (or FAL_AI_API_KEY) not configured');
  fal.config({ credentials: apiKey });
}

/**
 * Submit an image-to-video job. Returns the Fal request_id immediately;
 * the caller is responsible for polling via getStatus / getResult.
 */
async function submit({ imageUrl, prompt, modelId = DEFAULT_MODEL, duration = 5, resolution = '1080p' }) {
  configureFal();
  const { request_id } = await fal.queue.submit(modelId, {
    input: {
      image_url: imageUrl,
      prompt,
      duration,
      resolution,
    },
  });
  return { requestId: request_id, modelId };
}

async function getStatus({ requestId, modelId = DEFAULT_MODEL }) {
  configureFal();
  return fal.queue.status(modelId, { requestId, logs: false });
}

async function getResult({ requestId, modelId = DEFAULT_MODEL }) {
  configureFal();
  const result = await fal.queue.result(modelId, { requestId });
  // Shape differs between models; normalise.
  const video = result?.data?.video || result?.video;
  const videoUrl = video?.url || result?.data?.video_url || result?.video_url;
  if (!videoUrl) throw new Error('Fal result had no video URL');
  return { videoUrl, raw: result };
}

/**
 * Download Fal's final video URL to a local path. Buffers into a file so
 * FFmpeg can consume it directly.
 */
async function downloadVideo(videoUrl, localPath) {
  const response = await axios.get(videoUrl, {
    responseType: 'stream',
    timeout: 300_000,
  });
  await fs.ensureDir(require('path').dirname(localPath));
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
    response.data.on('error', reject);
  });
  return localPath;
}

module.exports = {
  submit,
  getStatus,
  getResult,
  downloadVideo,
  defaultModelId: DEFAULT_MODEL,
};
