/**
 * Higgsfield Soul image generation service.
 *
 * Submits a text-to-image (or image-to-image when a product reference is
 * provided) job to Higgsfield's queued API and polls until it completes.
 * Returned `images[].url` is a temporary CDN URL we then download and push
 * to R2 ourselves -- same storage model as the existing Fal path.
 *
 * Docs: https://docs.higgsfield.ai/guides/images
 *       https://docs.higgsfield.ai/how-to/introduction
 *
 * Auth: `Authorization: Key <HIGGSFIELD_API_KEY>:<HIGGSFIELD_API_SECRET>`
 *
 * Why a separate service: Higgsfield uses an async queue with a separate
 * status endpoint, while Fal's `fal.run/...` is one-shot. Mashing the two
 * into a single function would obscure both. The cartoon image service
 * dispatches between them based on `IMAGE_PROVIDER`.
 */

const axios = require('axios');

const BASE_URL = 'https://platform.higgsfield.ai';
const MODEL_ID = 'higgsfield-ai/soul/standard';

// Higgsfield Soul allowed aspect ratios (per docs as of 2026-04). We map
// the project's requested ratio to the closest supported value.
const SUPPORTED_ASPECT_RATIOS = new Set([
  '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9',
]);

function isConfigured() {
  return !!(process.env.HIGGSFIELD_API_KEY && process.env.HIGGSFIELD_API_SECRET);
}

function authHeader() {
  return `Key ${process.env.HIGGSFIELD_API_KEY}:${process.env.HIGGSFIELD_API_SECRET}`;
}

function pickAspectRatio(ratio) {
  if (ratio && SUPPORTED_ASPECT_RATIOS.has(ratio)) return ratio;
  // Fall back to widescreen since cartoon scenes are landscape by default.
  return '16:9';
}

/**
 * Soul rejects seeds outside 0..1_000_000 (422). Our Fal path uses a wider
 * random range; map any integer into the valid Soul range (same envelope as
 * @higgsfield/client `seed()`).
 */
function normalizeSoulSeed(seed) {
  if (seed == null || !Number.isFinite(Number(seed))) return null;
  const n = Math.floor(Number(seed));
  return ((n % 1_000_001) + 1_000_001) % 1_000_001;
}

function extractError(err) {
  if (err.response) {
    const status = err.response.status;
    const body = err.response.data;
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    return `HTTP ${status}: ${bodyStr.slice(0, 500)}`;
  }
  return err.message || 'unknown error';
}

/**
 * Submit a Soul generation request and return the queued response.
 * Caller polls status_url until completion.
 */
async function submit({
  prompt,
  aspectRatio,
  resolution,
  seed,
  imageUrl,
  customReferenceId,
  customReferenceStrength,
}) {
  const body = {
    prompt,
    aspect_ratio: pickAspectRatio(aspectRatio),
    resolution: resolution === '1080p' ? '1080p' : '720p',
  };
  const soulSeed = normalizeSoulSeed(seed);
  if (soulSeed != null) body.seed = soulSeed;
  if (customReferenceId) {
    body.custom_reference_id = customReferenceId;
    if (customReferenceStrength != null) {
      body.custom_reference_strength = customReferenceStrength;
    }
  } else if (imageUrl) {
    body.image_url = imageUrl;
  }

  const res = await axios.post(`${BASE_URL}/${MODEL_ID}`, body, {
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 60_000,
  });
  return res.data;
}

async function pollStatus(statusUrl) {
  const res = await axios.get(statusUrl, {
    headers: { Authorization: authHeader(), Accept: 'application/json' },
    timeout: 30_000,
  });
  return res.data;
}

/**
 * Submit + poll until completed (or failed/nsfw/cancelled). Returns the
 * first image URL plus the time spent waiting (in ms). Throws on failure
 * with a human-readable message.
 */
/**
 * Register a product / style image as a Higgsfield "custom reference" (Soul ID).
 * POST /v1/custom-references then poll until status is completed (official JS SDK).
 *
 * @param {{ imageUrl: string, name?: string, pollIntervalMs?: number, timeoutMs?: number }} opts
 * @returns {Promise<string>} custom reference id for use as custom_reference_id on Soul jobs
 */
async function createCustomReferenceFromImageUrl({
  imageUrl,
  name = 'product-reference',
  pollIntervalMs = 2000,
  timeoutMs = 300_000,
}) {
  if (!isConfigured()) {
    throw new Error('HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET not configured');
  }
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('createCustomReferenceFromImageUrl: imageUrl required');
  }

  const safeName = String(name || 'ref').slice(0, 200);
  const body = {
    name: safeName,
    input_images: [{ type: 'image_url', image_url: imageUrl }],
  };

  let id;
  try {
    const res = await axios.post(`${BASE_URL}/v1/custom-references`, body, {
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 60_000,
    });
    id = res.data?.id;
    if (!id) throw new Error('response missing id');
  } catch (err) {
    throw new Error(`Higgsfield custom-reference create failed: ${extractError(err)}`);
  }

  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() > deadline) {
      throw new Error(`Higgsfield custom-reference ${id} timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    let st;
    try {
      const res = await axios.get(`${BASE_URL}/v1/custom-references/${id}`, {
        headers: { Authorization: authHeader(), Accept: 'application/json' },
        timeout: 30_000,
      });
      st = res.data;
    } catch (err) {
      console.warn(`   ↳ Higgsfield Soul ID poll error (retry): ${extractError(err)}`);
      continue;
    }
    const status = st?.status;
    if (status === 'completed') return id;
    if (status === 'failed') {
      throw new Error(`Higgsfield custom-reference failed: ${st.error || JSON.stringify(st)}`);
    }
    // not_ready | queued | in_progress — keep polling
  }
}

async function generateOne({
  prompt,
  aspectRatio = '16:9',
  resolution = '720p',
  seed,
  imageUrl,
  customReferenceId,
  customReferenceStrength,
  pollIntervalMs = 1500,
  timeoutMs = 180_000,
}) {
  if (!isConfigured()) {
    throw new Error('HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET not configured');
  }

  const submitStart = Date.now();
  let queued;
  try {
    queued = await submit({
      prompt,
      aspectRatio,
      resolution,
      seed,
      imageUrl,
      customReferenceId,
      customReferenceStrength,
    });
  } catch (err) {
    throw new Error(`Higgsfield submit failed: ${extractError(err)}`);
  }
  const requestId = queued.request_id;
  const statusUrl = queued.status_url;
  if (!statusUrl) {
    // Some completions return inline. Defensive.
    if (queued.status === 'completed' && queued.images?.[0]?.url) {
      return {
        url: queued.images[0].url,
        requestId,
        elapsedMs: Date.now() - submitStart,
      };
    }
    throw new Error('Higgsfield response missing status_url');
  }

  // Poll loop.
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() > deadline) {
      throw new Error(`Higgsfield timed out after ${timeoutMs}ms (requestId ${requestId})`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    let st;
    try {
      st = await pollStatus(statusUrl);
    } catch (err) {
      // Transient poll failures shouldn't kill the whole job; log and retry.
      console.warn(`   ↳ Higgsfield poll error (will retry): ${extractError(err)}`);
      continue;
    }

    switch (st.status) {
      case 'completed': {
        const url = st.images?.[0]?.url;
        if (!url) throw new Error('Higgsfield completed without image URL');
        return { url, requestId, elapsedMs: Date.now() - submitStart };
      }
      case 'failed':
        throw new Error(`Higgsfield failed: ${st.error || 'no detail'}`);
      case 'nsfw':
        throw new Error('Higgsfield rejected the prompt: content moderation (nsfw)');
      case 'cancelled':
        throw new Error('Higgsfield request was cancelled');
      // queued / in_progress -> keep polling
      default:
        break;
    }
  }
}

module.exports = {
  isConfigured,
  generateOne,
  createCustomReferenceFromImageUrl,
  // Exposed for tests.
  _internal: { submit, pollStatus, normalizeSoulSeed },
};
