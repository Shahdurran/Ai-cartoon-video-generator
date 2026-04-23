/**
 * Cartoon image service -- generates N Flux variants per scene prompt,
 * applying the scene's style (suffix + negative prompt) and pushing results
 * to R2. Built alongside the existing ImageService rather than rewriting it,
 * so legacy flows are untouched.
 */

const axios = require('axios');
const apiConfig = require('../config/api.config');
const r2Service = require('./r2Service');

const ASPECT_RATIO_MAP = {
  '1:1': 'square',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
  '3:4': 'portrait_4_3',
  '21:9': 'landscape_21_9',
};

function buildFluxPrompt(basePrompt, style) {
  if (!style) return basePrompt;
  const suffix = style.fluxPromptSuffix || style.flux_prompt_suffix || '';
  return suffix ? `${basePrompt}${suffix}` : basePrompt;
}

function buildNegativePrompt(style) {
  return style?.negativePrompt || style?.negative_prompt || null;
}

async function callFluxOnce(prompt, { aspectRatio = '16:9', model = 'dev', negativePrompt = null, seed = null } = {}) {
  const apiKey = apiConfig.falAI.apiKey;
  if (!apiKey) throw new Error('FAL_AI_API_KEY not configured');

  const endpoint = model === 'pro'
    ? 'https://fal.run/fal-ai/flux-pro'
    : 'https://fal.run/fal-ai/flux/dev';

  const body = {
    prompt,
    image_size: ASPECT_RATIO_MAP[aspectRatio] || 'landscape_16_9',
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    enable_safety_checker: true,
  };
  if (negativePrompt) body.negative_prompt = negativePrompt;
  if (seed !== null && seed !== undefined) body.seed = seed;

  const res = await axios.post(endpoint, body, {
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 180_000,
  });

  const image = res.data?.images?.[0];
  if (!image?.url) throw new Error('Fal.AI response had no image URL');
  return {
    url: image.url,
    width: image.width,
    height: image.height,
    seed: res.data?.seed,
  };
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
 * @param {string} [input.model='dev']
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
    model = 'dev',
  } = input;

  if (!projectId || !sceneId) throw new Error('projectId and sceneId required');
  if (!prompt) throw new Error('prompt required');

  const fullPrompt = buildFluxPrompt(prompt, style);
  const negativePrompt = buildNegativePrompt(style);

  const variants = [];
  for (let i = 0; i < variantCount; i++) {
    try {
      const flux = await callFluxOnce(fullPrompt, {
        aspectRatio,
        model,
        negativePrompt,
        seed: Math.floor(Math.random() * 1_000_000_000),
      });
      const buf = await downloadImageBuffer(flux.url);
      const r2Key = r2Service.keys.sceneImage(projectId, sceneId, i, 'png');
      if (r2Service.isConfigured()) {
        await r2Service.upload(r2Key, buf, 'image/png');
      } else {
        console.warn('⚠️  R2 not configured; image generated but not uploaded');
      }
      variants.push({
        variantIndex: i,
        r2Key,
        promptUsed: fullPrompt,
        width: flux.width,
        height: flux.height,
        seed: flux.seed,
      });
    } catch (err) {
      console.error(`   ❌ Flux variant ${i} failed:`, err.message);
      // Continue with other variants rather than abort.
    }

    if (i < variantCount - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (variants.length === 0) {
    throw new Error('All Flux variants failed');
  }
  return variants;
}

module.exports = { generateSceneVariants, buildFluxPrompt, buildNegativePrompt };
