/**
 * Cartoon image service -- generates N image variants per scene prompt,
 * applying the scene's style (suffix + negative prompt) and pushing results
 * to R2. Built alongside the existing ImageService rather than rewriting it,
 * so legacy flows are untouched.
 *
 * Primary model: Nano Banana 2 (fal-ai/nano-banana-2). Google's Gemini 3.1
 * Flash Image -- reasoning-guided generation with accurate text rendering,
 * character consistency across frames, and vibrant output. See
 * https://fal.ai/docs/model-api-reference/image-generation-api/nano-banana-2
 *
 * Fallback chain (per variant) if Nano Banana 2 fails:
 *   1. Nano Banana 2    (fal-ai/nano-banana-2)       -- primary
 *   2. Flux Dev         (fal-ai/flux/dev)            -- fallback
 *   3. Flux schnell     (fal-ai/flux/schnell)        -- last resort
 *
 * None of these endpoints expose a dedicated `negative_prompt` field, so
 * we inline the style's negative prompt into the text as an "Avoid:" clause.
 */

const axios = require('axios');
const apiConfig = require('../config/api.config');
const r2Service = require('./r2Service');

// Flux Dev / schnell / Flux Pro all use this enum.
const FLUX_ASPECT_RATIO_MAP = {
  '1:1': 'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
  '3:4': 'portrait_4_3',
  '21:9': 'landscape_16_9', // Flux Dev has no 21:9 -- nearest match
};

// Nano Banana 2 uses raw aspect ratio strings. The v2 endpoint also supports
// extreme ratios (4:1, 1:4, 8:1, 1:8) but we don't expose those upstream.
const NANO_BANANA_ASPECT_RATIOS = new Set([
  'auto', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16',
  '4:1', '1:4', '8:1', '1:8',
]);

const NANO_BANANA_RESOLUTIONS = new Set(['0.5K', '1K', '2K', '4K']);

function buildPositivePrompt(basePrompt, style) {
  if (!style) return basePrompt;
  const suffix = style.fluxPromptSuffix || style.flux_prompt_suffix || '';
  return suffix ? `${basePrompt}${suffix}` : basePrompt;
}

function buildNegativePrompt(style) {
  return style?.negativePrompt || style?.negative_prompt || null;
}

/**
 * None of the current Fal endpoints expose a dedicated negative_prompt
 * field, so we inline it into the prompt text as an "avoid:" clause.
 * This is what fal.ai's own playgrounds recommend for Flux Dev.
 */
function composeFinalPrompt(positivePrompt, negativePrompt) {
  if (!negativePrompt) return positivePrompt;
  return `${positivePrompt}. Avoid: ${negativePrompt}`;
}

function extractAxiosError(err) {
  if (err.response) {
    const status = err.response.status;
    const body = err.response.data;
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    return `HTTP ${status}: ${bodyStr.slice(0, 500)}`;
  }
  return err.message;
}

async function postToFal(endpoint, body, apiKey) {
  const res = await axios.post(endpoint, body, {
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 180_000,
  });
  return res.data;
}

async function callFluxDev({ prompt, aspectRatio, seed, apiKey }) {
  const body = {
    prompt,
    image_size: FLUX_ASPECT_RATIO_MAP[aspectRatio] || 'landscape_16_9',
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    enable_safety_checker: true,
    output_format: 'png',
  };
  if (seed !== null && seed !== undefined) body.seed = seed;

  const data = await postToFal('https://fal.run/fal-ai/flux/dev', body, apiKey);
  const image = data?.images?.[0];
  if (!image?.url) throw new Error('Flux Dev response had no image URL');
  return { url: image.url, width: image.width, height: image.height, seed: data?.seed, model: 'flux-dev' };
}

async function callFluxSchnell({ prompt, aspectRatio, seed, apiKey }) {
  const body = {
    prompt,
    image_size: FLUX_ASPECT_RATIO_MAP[aspectRatio] || 'landscape_16_9',
    num_inference_steps: 4,
    num_images: 1,
    enable_safety_checker: true,
  };
  if (seed !== null && seed !== undefined) body.seed = seed;

  const data = await postToFal('https://fal.run/fal-ai/flux/schnell', body, apiKey);
  const image = data?.images?.[0];
  if (!image?.url) throw new Error('Flux schnell response had no image URL');
  return { url: image.url, width: image.width, height: image.height, seed: data?.seed, model: 'flux-schnell' };
}

async function callNanoBanana({ prompt, aspectRatio, seed, resolution, apiKey }) {
  const body = {
    prompt,
    aspect_ratio: NANO_BANANA_ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : 'auto',
    num_images: 1,
    output_format: 'png',
    resolution: NANO_BANANA_RESOLUTIONS.has(resolution) ? resolution : '1K',
    safety_tolerance: '4',
    // Prevents the model from generating intermediate drafts or interpreting
    // numeric phrases in the prompt as multi-image instructions -- we manage
    // variant count ourselves via the outer loop.
    limit_generations: true,
  };
  if (seed !== null && seed !== undefined) body.seed = seed;

  const data = await postToFal('https://fal.run/fal-ai/nano-banana-2', body, apiKey);
  const image = data?.images?.[0];
  if (!image?.url) throw new Error('Nano Banana 2 response had no image URL');
  return { url: image.url, width: image.width, height: image.height, seed: data?.seed, model: 'nano-banana-2' };
}

/**
 * Run the model cascade until one succeeds. Throws with aggregated error
 * details if every provider fails, so upstream logs show the real reason
 * rather than the generic "Flux variant N failed".
 */
async function callImageCascade(prompt, { aspectRatio, seed, resolution, preferredModel }) {
  const apiKey = apiConfig.falAI.apiKey;
  if (!apiKey) throw new Error('FAL_AI_API_KEY not configured');

  const cascade = preferredModel === 'flux-dev'
    ? [callFluxDev, callNanoBanana, callFluxSchnell]
    : [callNanoBanana, callFluxDev, callFluxSchnell];

  const errors = [];
  for (const fn of cascade) {
    try {
      return await fn({ prompt, aspectRatio, seed, resolution, apiKey });
    } catch (err) {
      const msg = extractAxiosError(err);
      errors.push(`${fn.name}: ${msg}`);
      console.warn(`   ↳ ${fn.name} failed: ${msg}`);
    }
  }
  throw new Error(`All image providers failed:\n  - ${errors.join('\n  - ')}`);
}

async function downloadImageBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60_000 });
  return Buffer.from(res.data);
}

/**
 * Generate N variants and upload each to R2.
 *
 * @param {object} input
 * @param {string} input.projectId
 * @param {string} input.sceneId
 * @param {string} input.prompt         Base image prompt from the scene.
 * @param {object} [input.style]        Style row (fluxPromptSuffix, negativePrompt).
 * @param {number} [input.variantCount=3]
 * @param {string} [input.aspectRatio='16:9']
 * @param {string} [input.model='nano-banana-2']  'nano-banana-2' | 'flux-dev'
 * @param {string} [input.resolution='1K']        Nano Banana only: '0.5K'|'1K'|'2K'|'4K'
 * @returns {Promise<Array<{variantIndex, r2Key, promptUsed, width, height, seed}>>}
 */
async function generateSceneVariants(input) {
  const {
    projectId,
    sceneId,
    prompt,
    style = null,
    variantCount = 3,
    aspectRatio = '16:9',
    model = 'nano-banana-2',
    resolution = '1K',
  } = input;

  if (!projectId || !sceneId) throw new Error('projectId and sceneId required');
  if (!prompt) throw new Error('prompt required');

  const positivePrompt = buildPositivePrompt(prompt, style);
  const negativePrompt = buildNegativePrompt(style);
  const finalPrompt = composeFinalPrompt(positivePrompt, negativePrompt);
  const preferredModel = model === 'flux-dev' || model === 'dev' ? 'flux-dev' : 'nano-banana-2';

  const variants = [];
  const errors = [];
  for (let i = 0; i < variantCount; i++) {
    try {
      const img = await callImageCascade(finalPrompt, {
        aspectRatio,
        seed: Math.floor(Math.random() * 1_000_000_000),
        resolution,
        preferredModel,
      });
      const buf = await downloadImageBuffer(img.url);
      const r2Key = r2Service.keys.sceneImage(projectId, sceneId, i, 'png');
      if (r2Service.isConfigured()) {
        await r2Service.upload(r2Key, buf, 'image/png');
      } else {
        console.warn('⚠️  R2 not configured; image generated but not uploaded');
      }
      variants.push({
        variantIndex: i,
        r2Key,
        promptUsed: finalPrompt,
        width: img.width,
        height: img.height,
        seed: img.seed,
        modelUsed: img.model,
      });
      console.log(`   ✅ Variant ${i} generated via ${img.model}`);
    } catch (err) {
      console.error(`   ❌ Variant ${i} failed: ${err.message}`);
      errors.push(`variant ${i}: ${err.message}`);
    }

    if (i < variantCount - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (variants.length === 0) {
    throw new Error(`All image variants failed:\n${errors.join('\n')}`);
  }
  return variants;
}

module.exports = {
  generateSceneVariants,
  buildFluxPrompt: buildPositivePrompt, // back-compat alias
  buildPositivePrompt,
  buildNegativePrompt,
  composeFinalPrompt,
};
