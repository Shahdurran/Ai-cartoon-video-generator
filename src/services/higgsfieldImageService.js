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
async function submit({ prompt, aspectRatio, resolution, seed, imageUrl }) {
  const body = {
    prompt,
    aspect_ratio: pickAspectRatio(aspectRatio),
    resolution: resolution === '1080p' ? '1080p' : '720p',
  };
  if (seed != null) body.seed = seed;
  if (imageUrl) body.image_url = imageUrl;

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
async function generateOne({
  prompt,
  aspectRatio = '16:9',
  resolution = '720p',
  seed,
  imageUrl,
  pollIntervalMs = 1500,
  timeoutMs = 180_000,
}) {
  if (!isConfigured()) {
    throw new Error('HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET not configured');
  }

  const submitStart = Date.now();
  let queued;
  try {
    queued = await submit({ prompt, aspectRatio, resolution, seed, imageUrl });
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
  // Exposed for tests.
  _internal: { submit, pollStatus },
};
