/**
 * Cartoon image service -- generates N image variants per scene prompt,
 * applying the scene's style (suffix + negative prompt) and pushing results
 * to R2. Built alongside the existing ImageService rather than rewriting it,
 * so legacy flows are untouched.
 *
 * Primary model: Nano Banana 2 (fal-ai/nano-banana-2). When the user
 * attached a product reference image and Higgsfield is unavailable, the Fal
 * fallback uses fal-ai/nano-banana-2/edit with `image_urls` so the packshot
 * is still fed into generation.
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
const { mergeImageModelSettings } = require('../config/mediaModelDefaults');
const r2Service = require('./r2Service');
const higgsfield = require('./higgsfieldImageService');

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

function clipText(text, maxLen) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 3)).trim()}...`;
}

function applyCharacterConsistencyPrompt(basePrompt, characterConsistency = null) {
  if (!characterConsistency || !characterConsistency.anchorPrompt) {
    return basePrompt;
  }
  const anchor = clipText(characterConsistency.anchorPrompt, 700);
  const refs = Array.isArray(characterConsistency.anchorSceneIndices)
    ? characterConsistency.anchorSceneIndices.join(', ')
    : '';
  const refsLine = refs ? `Reference scenes: ${refs}.` : 'Reference scenes: prior scenes.';

  return [
    'Character continuity requirement:',
    'Keep the recurring main character visually consistent with the established identity from earlier scenes.',
    refsLine,
    `Anchor description from earlier scenes: ${anchor}`,
    'Preserve facial structure, hair color/style, age range, skin tone, body build, and signature outfit elements.',
    'Allow normal variation in camera angle, pose, lighting, and expression. Only change identity/outfit when the scene explicitly requires it.',
    '',
    basePrompt,
  ].join('\n');
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

/**
 * Map a raw provider error string to a stable code the UI can render
 * explanatory copy for. Order of checks matters -- specific signals before
 * generic ones. Returns one of:
 *   content_policy | rate_limit | quota | auth | timeout | network |
 *   bad_request   | unknown
 */
function classifyImageError(message) {
  if (!message) return 'unknown';
  const m = String(message).toLowerCase();

  if (
    m.includes('content_policy') ||
    m.includes('safety') ||
    m.includes('nsfw') ||
    m.includes('content filter') ||
    m.includes('moderation') ||
    m.includes('blocked')
  ) return 'content_policy';

  if (m.includes('429') || m.includes('rate limit') || m.includes('too many requests')) {
    return 'rate_limit';
  }

  if (
    m.includes('quota') ||
    m.includes('insufficient') ||
    m.includes('not_enough_credits') ||
    m.includes('not enough credits') ||
    m.includes('out of credits') ||
    m.includes('payment required') ||
    m.includes('402')
  ) return 'quota';

  if (
    m.includes('401') ||
    m.includes('403') ||
    m.includes('unauthorized') ||
    m.includes('forbidden') ||
    m.includes('invalid api key') ||
    m.includes('not configured')
  ) return 'auth';

  if (m.includes('timeout') || m.includes('etimedout')) return 'timeout';

  if (
    m.includes('econn') ||
    m.includes('enotfound') ||
    m.includes('network') ||
    m.includes('socket hang up') ||
    m.includes('fetch failed')
  ) return 'network';

  if (m.includes('400') || m.includes('bad request') || m.includes('validation')) {
    return 'bad_request';
  }

  return 'unknown';
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

/**
 * Soul uses either a registered custom reference (Soul ID) or `image_url`
 * for product conditioning; the text prompt still drives most of the layout.
 * Without explicit instructions the model often invents generic props.
 */
function buildHiggsfieldPromptWithProductRef(userPrompt) {
  return [
    'The client supplied a registered product reference (Soul custom reference / conditioning image) — that is the actual product (exact packaging, logo, colors, shape, and proportions).',
    'Reproduce that specific product in the output. Do not substitute a different product, generic scrolls, random bottles, or unrelated props in its place.',
    'If the scene text says the character holds or presents this product, both hands must interact with it: show fingers wrapped around it or clearly presenting it — never empty fists, hands behind the back, or cropped-away hands when holding is required.',
    'The following text describes the scene, camera, characters, and how the product should appear (placement, hands, table, etc.). Obey it while keeping the product visually consistent with that reference.',
    '',
    userPrompt,
  ].join(' ');
}

/**
 * Higgsfield Soul image generation. Faster than the Fal cascade in our
 * benchmarks (single-digit seconds vs. 15-30s for Nano Banana 2). Used as
 * the primary provider when IMAGE_PROVIDER=higgsfield (the default in
 * .env.example) and HIGGSFIELD_API_KEY+SECRET are set.
 *
 * When a Higgsfield Soul ID exists (`productCustomReferenceId`), uses
 * `custom_reference_id` (+ strength) for stronger identity lock; otherwise
 * falls back to `image_url` with the product image URL.
 */
async function callHiggsfield({
  prompt,
  aspectRatio,
  seed,
  productReferenceUrl,
  productCustomReferenceId,
  soul = {},
}) {
  const promptForModel = productReferenceUrl || productCustomReferenceId
    ? buildHiggsfieldPromptWithProductRef(prompt)
    : prompt;
  let strength = 0.85;
  if (typeof soul.customReferenceStrength === 'number' && Number.isFinite(soul.customReferenceStrength)) {
    strength = Math.min(1, Math.max(0, soul.customReferenceStrength));
  }
  const result = await higgsfield.generateOne({
    prompt: promptForModel,
    aspectRatio,
    resolution: soul.resolution === '1080p' ? '1080p' : '720p',
    seed,
    imageUrl: productCustomReferenceId ? null : (productReferenceUrl || null),
    customReferenceId: productCustomReferenceId || null,
    customReferenceStrength: productCustomReferenceId ? strength : undefined,
  });
  return {
    url: result.url,
    width: null,
    height: null,
    seed,
    model: 'higgsfield-soul',
    elapsedMs: result.elapsedMs,
  };
}

function buildNanoBananaProductRefPrompt(userPrompt) {
  return [
    'EDIT TASK: place the exact product shown in the first reference image INTO the scene below.',
    'The reference is the client\'s real product — preserve its packaging, label text, typography, colors, shape, proportions, and finish. Treat the reference as ground truth for the product.',
    'Do not substitute a different product, invent new packaging, or replace it with generic scrolls, bottles, boxes, or props.',
    'If the scene text says a character holds, presents, or uses the product: the product must appear in the frame at the size implied by the scene, held in/near the character\'s hands with visible contact (fingers wrapped or palm supporting it), label facing the camera when plausible. Never show empty fists, hands behind the back, or cropped hands when holding is required.',
    'If the scene implies the product is on a surface, place it prominently on that surface so its label is legible.',
    'Match the scene\'s illustration style, lighting, and composition while keeping the product photographically faithful to the reference.',
    '',
    'SCENE:',
    userPrompt,
  ].join('\n');
}

async function callNanoBanana({ prompt, aspectRatio, seed, apiKey, nano = {}, productReferenceUrl = null }) {
  const outFmt = ['jpeg', 'png', 'webp'].includes(nano.output_format) ? nano.output_format : 'png';
  const resStr = NANO_BANANA_RESOLUTIONS.has(nano.resolution) ? nano.resolution : '1K';
  const tol = ['1', '2', '3', '4', '5', '6'].includes(String(nano.safety_tolerance))
    ? String(nano.safety_tolerance)
    : '4';
  const ratio = NANO_BANANA_ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : 'auto';

  const baseModelId = (nano.imageModelId || 'fal-ai/nano-banana-2').replace(/^\//, '');
  const canUseProductEdit =
    Boolean(productReferenceUrl) &&
    (baseModelId === 'fal-ai/nano-banana-2' || baseModelId === 'fal-ai/nano-banana-2/t2i');
  const endpointId = canUseProductEdit ? 'fal-ai/nano-banana-2/edit' : baseModelId;
  const promptForModel = canUseProductEdit
    ? buildNanoBananaProductRefPrompt(prompt)
    : prompt;

  const body = {
    prompt: promptForModel,
    aspect_ratio: ratio,
    num_images: 1,
    output_format: outFmt,
    resolution: resStr,
    safety_tolerance: tol,
    limit_generations: nano.limit_generations !== false,
    sync_mode: !!nano.sync_mode,
    enable_web_search: !!nano.enable_web_search,
  };
  if (seed !== null && seed !== undefined) body.seed = seed;
  if (nano.thinking_level === 'minimal' || nano.thinking_level === 'high') {
    body.thinking_level = nano.thinking_level;
  }
  if (canUseProductEdit) {
    body.image_urls = [productReferenceUrl];
    // Nano Banana 2 Edit tends to drop the product with a single packshot and
    // loose styling prompt. Reasoning helps it actually place the product, and
    // 2K gives it room to render the label legibly. Callers can still override
    // via imageModelSettings.nanoBanana2.
    if (!body.thinking_level) body.thinking_level = 'high';
    if (!nano.resolution) body.resolution = '2K';
  }

  const data = await postToFal(`https://fal.run/${endpointId}`, body, apiKey);
  const image = data?.images?.[0];
  if (!image?.url) throw new Error('Nano Banana 2 response had no image URL');
  return {
    url: image.url,
    width: image.width,
    height: image.height,
    seed: data?.seed,
    model: canUseProductEdit ? 'nano-banana-2-edit' : 'nano-banana-2',
  };
}

/**
 * Determine which provider should run first. Honours the IMAGE_PROVIDER
 * env knob (`higgsfield` | `fal`) and falls back to the existing Fal-only
 * behaviour when Higgsfield isn't configured. Returns the cascade as an
 * ordered array of `{ name, fn }` so the loop can log per-provider
 * benchmarks consistently.
 */
function buildCascade({ preferredModel, imageProvider }) {
  const envPref = (process.env.IMAGE_PROVIDER || 'higgsfield').toLowerCase();
  const explicit =
    imageProvider && ['higgsfield', 'fal'].includes(String(imageProvider).toLowerCase())
      ? String(imageProvider).toLowerCase()
      : null;
  const effective = explicit || envPref;
  const wantHiggsfield =
    effective === 'higgsfield' && higgsfield.isConfigured();

  const fal =
    preferredModel === 'flux-dev'
      ? [
          { name: 'flux-dev', fn: callFluxDev, kind: 'flux' },
          { name: 'nano-banana-2', fn: callNanoBanana, kind: 'nano' },
          { name: 'flux-schnell', fn: callFluxSchnell, kind: 'flux' },
        ]
      : [
          { name: 'nano-banana-2', fn: callNanoBanana, kind: 'nano' },
          { name: 'flux-dev', fn: callFluxDev, kind: 'flux' },
          { name: 'flux-schnell', fn: callFluxSchnell, kind: 'flux' },
        ];

  if (wantHiggsfield) {
    return [{ name: 'higgsfield-soul', fn: callHiggsfield, kind: 'higgsfield' }, ...fal];
  }
  return fal;
}

/**
 * Run the model cascade until one succeeds. Throws with aggregated error
 * details if every provider fails, so upstream logs show the real reason
 * rather than the generic "Flux variant N failed".
 *
 * Logs per-provider benchmark lines (`provider=…  ms=…  variant=…`) so
 * we can compare Higgsfield vs Fal speed in production logs without
 * spinning up a separate metrics pipeline.
 */
async function callImageCascade(prompt, ctx) {
  const {
    fluxAspectRatio,
    nanoAspectRatio,
    higgsfieldAspectRatio,
    seed,
    preferredModel,
    nanoBanana2,
    productReferenceUrl,
    productCustomReferenceId,
    soul,
    variantIndex,
  } = ctx;

  const apiKey = apiConfig.falAI.apiKey;
  // Fal key is still required for the fallback path -- only error out at
  // call time, after we've tried Higgsfield (which doesn't need it).
  const cascade = buildCascade({
    preferredModel,
    imageProvider: ctx.imageProvider,
  });
  const errors = [];

  for (const step of cascade) {
    const t0 = Date.now();
    try {
      if (step.kind === 'higgsfield') {
        const result = await step.fn({
          prompt,
          aspectRatio: higgsfieldAspectRatio,
          seed,
          productReferenceUrl,
          productCustomReferenceId,
          soul: soul || {},
        });
        const ms = Date.now() - t0;
        console.log(
          `[image-bench] provider=${step.name} variant=${variantIndex} ms=${ms} ref=${
            productCustomReferenceId ? 'soul-id' : productReferenceUrl ? 'url' : 'no'
          }`
        );
        return { ...result, elapsedMs: ms };
      }
      if (!apiKey) throw new Error('FAL_AI_API_KEY not configured');
      let result;
      if (step.kind === 'nano') {
        result = await step.fn({
          prompt,
          aspectRatio: nanoAspectRatio,
          seed,
          apiKey,
          nano: nanoBanana2 || {},
          productReferenceUrl,
        });
      } else {
        result = await step.fn({
          prompt,
          aspectRatio: fluxAspectRatio,
          seed,
          apiKey,
        });
      }
      const ms = Date.now() - t0;
      const refLog =
        result.model === 'nano-banana-2-edit'
          ? 'nano-edit'
          : 'no';
      console.log(
        `[image-bench] provider=${step.name} variant=${variantIndex} ms=${ms} ref=${refLog}`
      );
      return { ...result, elapsedMs: ms };
    } catch (err) {
      const ms = Date.now() - t0;
      const msg = extractAxiosError(err);
      errors.push(`${step.name}: ${msg}`);
      console.warn(`   ↳ ${step.name} failed in ${ms}ms: ${msg}`);
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
 * @param {object} [input.imageModelSettings]  merged in worker from `projects.image_model_settings`
 * @param {string} [input.productReferenceUrl] Optional product reference image URL
 * @param {string} [input.productCustomReferenceId] Higgsfield Soul ID from /v1/custom-references
 * @returns {Promise<Array<{variantIndex, r2Key, promptUsed, width, height, seed, modelUsed, elapsedMs}>>}
 */
async function generateSceneVariants(input) {
  const {
    projectId,
    sceneId,
    prompt,
    style = null,
    variantCount = 3,
    aspectRatio = '16:9',
    imageModelSettings = {},
    productReferenceUrl = null,
    productCustomReferenceId = null,
    characterConsistency = null,
    // Optional override so callers can route variants to a different R2
    // prefix (used by the shot-images processor to write into
    // .../shots/<shotId>/image-N.png instead of the scene-level key).
    r2KeyBuilder = null,
  } = input;

  if (!projectId || !sceneId) throw new Error('projectId and sceneId required');
  if (!prompt) throw new Error('prompt required');

  // Fail fast if R2 isn't configured -- otherwise we'd happily generate
  // images, write rows the UI can't render, and leave scenes stuck in
  // "rendering…" forever. The classifier maps this to errorCode 'auth'.
  if (!r2Service.isConfigured()) {
    throw new Error(
      'R2 storage is not configured. Set R2_ACCOUNT_ID (or R2_ENDPOINT), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET in the server .env, then restart.'
    );
  }

  const imgCfg = mergeImageModelSettings(imageModelSettings);
  const preferredModel =
    imgCfg.preferredCascade === 'flux-dev' || imgCfg.preferredCascade === 'dev'
      ? 'flux-dev'
      : 'nano-banana-2';

  const rawAspect = imgCfg.nanoBanana2?.aspect_ratio || aspectRatio;
  const nanoAspectRatio = NANO_BANANA_ASPECT_RATIOS.has(rawAspect) ? rawAspect : 'auto';
  const fluxAspectRatio =
    rawAspect === 'auto' || !FLUX_ASPECT_RATIO_MAP[rawAspect] ? '16:9' : rawAspect;
  // Higgsfield doesn't accept "auto"; fall back to the original requested
  // ratio (or 16:9 if the user picked auto).
  const higgsfieldAspectRatio = rawAspect === 'auto' ? '16:9' : rawAspect;

  const nanoBanana2 = {
    ...imgCfg.nanoBanana2,
    imageModelId: imgCfg.imageModelId || 'fal-ai/nano-banana-2',
  };
  const soul = imgCfg.higgsfieldSoul || {};

  const positivePrompt = buildPositivePrompt(prompt, style);
  const negativePrompt = buildNegativePrompt(style);
  const consistentPrompt = applyCharacterConsistencyPrompt(positivePrompt, characterConsistency);
  const finalPrompt = composeFinalPrompt(consistentPrompt, negativePrompt);

  const variants = [];
  const errors = [];
  const benchTotalStart = Date.now();
  for (let i = 0; i < variantCount; i++) {
    try {
      const img = await callImageCascade(finalPrompt, {
        fluxAspectRatio,
        nanoAspectRatio,
        higgsfieldAspectRatio,
        seed: Math.floor(Math.random() * 1_000_000_000),
        preferredModel,
        nanoBanana2,
        soul,
        productReferenceUrl,
        productCustomReferenceId,
        imageProvider: imgCfg.imageProvider,
        variantIndex: i,
      });
      const buf = await downloadImageBuffer(img.url);
      // Higgsfield + Flux always emit PNG/JPEG/WEBP via URL; we don't get
      // to pick the format, so default to PNG. Nano Banana respects the
      // `output_format` setting.
      const fmt = (nanoBanana2.output_format || 'png').toLowerCase();
      const ext = fmt === 'jpeg' ? 'jpg' : fmt === 'webp' ? 'webp' : 'png';
      const mime = ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      const r2Key = typeof r2KeyBuilder === 'function'
        ? r2KeyBuilder(i, ext)
        : r2Service.keys.sceneImage(projectId, sceneId, i, ext);
      await r2Service.upload(r2Key, buf, mime);
      variants.push({
        variantIndex: i,
        r2Key,
        promptUsed: finalPrompt,
        width: img.width,
        height: img.height,
        seed: img.seed,
        modelUsed: img.model,
        elapsedMs: img.elapsedMs,
      });
      console.log(`   ✅ Variant ${i} generated via ${img.model} in ${img.elapsedMs}ms`);
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

  const totalMs = Date.now() - benchTotalStart;
  const usedHiggsfield = variants.filter((v) => v.modelUsed === 'higgsfield-soul').length;
  console.log(
    `[image-bench] scene=${sceneId} variants=${variants.length}/${variantCount}` +
      ` totalMs=${totalMs} higgsfield=${usedHiggsfield} ref=${
        productCustomReferenceId ? 'soul-id' : productReferenceUrl ? 'url' : 'no'
      }`
  );

  return variants;
}

module.exports = {
  generateSceneVariants,
  buildFluxPrompt: buildPositivePrompt, // back-compat alias
  buildPositivePrompt,
  buildNegativePrompt,
  composeFinalPrompt,
  classifyImageError,
};
