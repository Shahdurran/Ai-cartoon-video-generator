/**
 * Fal.AI video service -- image-to-video (Seedance 2.0 by default, legacy Seedance v1 supported).
 *
 * Wraps the submit / poll / result pattern from @fal-ai/client. Model id and
 * per-model input fields come from `projects.video_model_settings` (merged
 * with defaults in `src/config/mediaModelDefaults.js`).
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs-extra');
const { mergeVideoModelSettings } = require('../config/mediaModelDefaults');

let fal;
try {
  ({ fal } = require('@fal-ai/client'));
} catch (err) {
  console.warn('⚠️  @fal-ai/client not installed -- Seedance will fail until npm install');
}

const DEFAULT_MODEL =
  process.env.VIDEO_MODEL_ID || 'bytedance/seedance-2.0/image-to-video';

function configureFal() {
  if (!fal) throw new Error('@fal-ai/client not available');
  const apiKey = process.env.FAL_KEY || process.env.FAL_AI_API_KEY;
  if (!apiKey) throw new Error('FAL_KEY (or FAL_AI_API_KEY) not configured');
  fal.config({ credentials: apiKey });
}

function isSeedance20(modelId) {
  const m = String(modelId || '');
  return m.includes('seedance-2.0') && m.includes('image-to-video');
}

/**
 * Build queue `input` for the given model.
 *
 * @param {object} opts
 * @param {string} opts.imageUrl
 * @param {string} opts.prompt
 * @param {string} opts.modelId
 * @param {object} opts.videoSettings  merged `mergeVideoModelSettings(project.videoModelSettings)`
 * @param {number|null} opts.sceneDurationSeconds  used for legacy v1 duration only
 * @param {number|null} opts.hookDurationSeconds   when set with Seedance 2.0, clamps duration string
 */
function buildVideoInput({
  imageUrl,
  prompt,
  modelId,
  videoSettings,
  sceneDurationSeconds = null,
  hookDurationSeconds = null,
}) {
  const s20 = videoSettings.seedance20 || {};

  if (isSeedance20(modelId)) {
    let duration = s20.duration != null && s20.duration !== '' ? String(s20.duration) : 'auto';
    if (hookDurationSeconds != null) {
      duration = String(
        Math.min(15, Math.max(4, Math.round(Number(hookDurationSeconds) || 10)))
      );
    }

    const input = {
      prompt,
      image_url: imageUrl,
      resolution: s20.resolution === '480p' ? '480p' : '720p',
      duration,
      aspect_ratio: s20.aspect_ratio || 'auto',
      generate_audio: s20.generate_audio !== false,
    };

    if (s20.seed != null && String(s20.seed).trim() !== '') {
      const n = Number(s20.seed);
      if (!Number.isNaN(n)) input.seed = Math.floor(n);
    }
    const endUrl = (s20.end_image_url || '').trim();
    if (endUrl) input.end_image_url = endUrl;
    const endUser = (s20.end_user_id || '').trim();
    if (endUser) input.end_user_id = endUser;

    return input;
  }

  // Legacy: fal-ai/bytedance/seedance/v1/pro/image-to-video (numeric duration).
  const dur = Math.min(
    10,
    Math.max(3, Math.round(Number(sceneDurationSeconds) || 5))
  );
  return {
    image_url: imageUrl,
    prompt,
    duration: dur,
    resolution: '1080p',
  };
}

/**
 * Submit an image-to-video job. Returns the Fal request_id immediately;
 * the caller is responsible for polling via getStatus / getResult.
 *
 * @param {object} params
 * @param {string} params.imageUrl
 * @param {string} params.prompt
 * @param {string} [params.modelId]
 * @param {object} [params.projectVideoSettings]  raw DB JSON (merged inside)
 * @param {number|null} [params.sceneDurationSeconds]
 * @param {number|null} [params.hookDurationSeconds]  forces Seedance 2.0 duration when set
 */
async function submit({
  imageUrl,
  prompt,
  modelId,
  projectVideoSettings = {},
  sceneDurationSeconds = null,
  hookDurationSeconds = null,
}) {
  configureFal();
  const videoSettings = mergeVideoModelSettings(projectVideoSettings);
  const effectiveModel = modelId || videoSettings.videoModelId || DEFAULT_MODEL;

  const input = buildVideoInput({
    imageUrl,
    prompt,
    modelId: effectiveModel,
    videoSettings,
    sceneDurationSeconds,
    hookDurationSeconds,
  });

  const { request_id } = await fal.queue.submit(effectiveModel, { input });
  return { requestId: request_id, modelId: effectiveModel };
}

async function getStatus({ requestId, modelId = DEFAULT_MODEL }) {
  configureFal();
  return fal.queue.status(modelId, { requestId, logs: false });
}

async function getResult({ requestId, modelId = DEFAULT_MODEL }) {
  configureFal();
  const result = await fal.queue.result(modelId, { requestId });
  const video = result?.data?.video || result?.video;
  const videoUrl = video?.url || result?.data?.video_url || result?.video_url;
  if (!videoUrl) throw new Error('Fal result had no video URL');
  return { videoUrl, raw: result };
}

/**
 * Download Fal's final video URL to a local path.
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
  isSeedance20,
  buildVideoInput,
};
