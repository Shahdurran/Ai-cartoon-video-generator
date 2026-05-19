/**
 * Fal.AI image-to-video (Seedance **1.0 Pro** default; **2.0** selectable in project video settings).
 *
 * Model id comes from `projects.video_model_settings.videoModelId` (merged via
 * `src/config/mediaModelDefaults.js`), overridden by `VIDEO_MODEL_ID` when set.
 *
 * ## Seedance 1.0 Pro (default)
 * Endpoint ID: `fal-ai/bytedance/seedance/v1/pro/image-to-video`
 * https://fal.ai/models/fal-ai/bytedance/seedance/v1/pro/image-to-video
 *
 * ## Seedance 2.0 Image To Video (optional)
 * Endpoint ID: `bytedance/seedance-2.0/image-to-video`
 * https://fal.ai/docs/model-api-reference/video-generation-api/bytedance-seedance-2.0-image-to-video.md
 *
 * 2.0 `input` fields: required `prompt`, `image_url`; optional `end_image_url`,
 * `resolution` (`480p` | `720p`), `duration` (`auto` | `"4"`…`"15"` strings),
 * `aspect_ratio` (enum), `generate_audio` (boolean), `seed` (integer), `end_user_id` (string).
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
  process.env.VIDEO_MODEL_ID ||
  'fal-ai/bytedance/seedance/v1/pro/image-to-video';

function configureFal() {
  if (!fal) throw new Error('@fal-ai/client not available');
  const apiKey = process.env.FAL_KEY || process.env.FAL_AI_API_KEY;
  if (!apiKey) throw new Error('FAL_KEY (or FAL_AI_API_KEY) not configured');
  fal.config({ credentials: apiKey });
}

function isSeedance20(modelId) {
  const m = String(modelId || '');
  // Endpoint ID from Fal: `bytedance/seedance-2.0/image-to-video` (also match `fal-ai/` prefixed ids).
  return m.includes('seedance-2.0') && m.includes('image-to-video');
}

/** Fal queue id for Seedance 1.0 Pro image-to-video (see fal.ai docs). */
function isSeedanceV1ProImageToVideo(modelId) {
  const m = String(modelId || '');
  return (
    m.includes('seedance/v1/pro/image-to-video') ||
    (m.includes('seedance/v1/pro') && m.includes('image-to-video'))
  );
}

const SEEDANCE_20_DURATIONS = new Set([
  'auto',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
]);

/**
 * Seedance 2.0 duration: "auto" or string seconds "4"–"15" per Fal schema.
 */
function normalizeSeedance20Duration(rawDuration, hookDurationSeconds) {
  if (hookDurationSeconds != null) {
    const n = Math.min(15, Math.max(4, Math.round(Number(hookDurationSeconds) || 10)));
    return String(n);
  }
  if (rawDuration == null || rawDuration === '') return 'auto';
  const s = String(rawDuration).trim();
  if (s === 'auto') return 'auto';
  const n = Number(s);
  if (!Number.isNaN(n)) {
    return String(Math.min(15, Math.max(4, Math.round(n))));
  }
  return SEEDANCE_20_DURATIONS.has(s) ? s : 'auto';
}

function normalizeSeedance20Resolution(r) {
  return r === '480p' ? '480p' : '720p';
}

const SEEDANCE_20_ASPECT = new Set(['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);

function normalizeSeedance20AspectRatio(ar) {
  const s = String(ar || 'auto').trim();
  return SEEDANCE_20_ASPECT.has(s) ? s : 'auto';
}

function coerceBool(v, defaultTrue = true) {
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  return defaultTrue;
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
    // --- Seedance 2.0 input (see module header for doc link) ---
    const duration = normalizeSeedance20Duration(s20.duration, hookDurationSeconds);
    const resolution = normalizeSeedance20Resolution(s20.resolution);
    const generate_audio = coerceBool(s20.generate_audio, true);

    const input = {
      prompt,
      image_url: imageUrl,
      resolution,
      duration,
      aspect_ratio: normalizeSeedance20AspectRatio(s20.aspect_ratio),
      generate_audio,
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

  // Seedance 1.0 Pro — fal-ai/bytedance/seedance/v1/pro/image-to-video
  // duration must be string enum "2".."12" (not a number) or Fal returns 422.
  const aspect_ratio = normalizeSeedance20AspectRatio(s20.aspect_ratio);

  if (isSeedanceV1ProImageToVideo(modelId)) {
    const secs = Math.min(12, Math.max(2, Math.round(Number(sceneDurationSeconds) || 5)));
    return {
      prompt,
      image_url: imageUrl,
      duration: String(secs),
      resolution: '1080p',
      aspect_ratio,
      enable_safety_checker: true,
      camera_fixed: false,
    };
  }

  // Other legacy image-to-video: use string duration for strict JSON schemas.
  const secs = Math.min(12, Math.max(2, Math.round(Number(sceneDurationSeconds) || 5)));
  return {
    image_url: imageUrl,
    prompt,
    duration: String(secs),
    resolution: '1080p',
    aspect_ratio,
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

  if (!String(input.prompt || '').trim()) {
    throw new Error('Fal image-to-video requires a non-empty prompt');
  }
  if (!String(input.image_url || '').trim()) {
    throw new Error('Fal image-to-video requires image_url');
  }

  let request_id;
  try {
    const res = await fal.queue.submit(effectiveModel, { input });
    request_id = res.request_id;
  } catch (err) {
    const detail =
      err?.response?.data ||
      err?.body ||
      err?.data ||
      err?.message ||
      String(err);
    console.error(
      '[falVideo/submit] model=%s detail=%s',
      effectiveModel,
      typeof detail === 'string' ? detail : JSON.stringify(detail)
    );
    // Surface a richer message than the bare HTTP reason so the UI can
    // tell the user *why* the render failed (most 422s are content-
    // policy rejections on the input image; a vague "Unprocessable
    // Entity" gives the user nothing actionable).
    const status = err?.status ?? err?.response?.status;
    const bodyText =
      typeof detail === 'string'
        ? detail
        : (() => {
            try {
              return JSON.stringify(detail);
            } catch {
              return '';
            }
          })();
    const looksLikeContentPolicy =
      status === 422 ||
      /content.?policy|moderation|nsfw|unsafe/i.test(bodyText);
    if (looksLikeContentPolicy) {
      const e = new Error(
        'Seedance rejected the input image (content policy). ' +
          'Pick a different image variant for this shot and try again. ' +
          `(${err?.message || 'Unprocessable Entity'})`
      );
      e.code = 'content_policy';
      e.cause = err;
      throw e;
    }
    throw err;
  }
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
  isSeedanceV1ProImageToVideo,
  buildVideoInput,
};
