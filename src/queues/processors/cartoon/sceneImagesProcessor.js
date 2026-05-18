/**
 * Scene images processor -- generates 3-4 Flux variants for a single scene
 * and uploads them to R2.
 *
 * Job data (generate-variants):
 *   { projectId, sceneId, variantCount=3, clearExisting=false, customPrompt? }
 *
 * Job data (insert-product):
 *   { projectId, sceneId, baseSceneImageId, productR2Key, instruction?, variantCount=1 }
 *
 * If `customPrompt` is supplied, it replaces the scene's prompt for this
 * run (used by POST /scenes/:id/regenerate-image).
 */

const cartoonImage = require('../../../services/cartoonImageService');
const sceneRepo = require('../../../db/repositories/sceneRepo');
const sceneImageRepo = require('../../../db/repositories/sceneImageRepo');
const projectRepo = require('../../../db/repositories/projectRepo');
const projectVisualReferenceRepo = require('../../../db/repositories/projectVisualReferenceRepo');
const styleRepo = require('../../../db/repositories/styleRepo');
const r2Service = require('../../../services/r2Service');
const pubsub = require('../../../services/pubsubService');
const higgsfield = require('../../../services/higgsfieldImageService');
const { mergeImageModelSettings } = require('../../../config/mediaModelDefaults');

function higgsfieldIsPrimaryProvider(imageModelSettings) {
  const imgCfg = mergeImageModelSettings(imageModelSettings || {});
  const explicit =
    imgCfg.imageProvider && ['higgsfield', 'fal'].includes(String(imgCfg.imageProvider).toLowerCase())
      ? String(imgCfg.imageProvider).toLowerCase()
      : null;
  const effective = explicit || (process.env.IMAGE_PROVIDER || 'higgsfield').toLowerCase();
  return effective === 'higgsfield' && higgsfield.isConfigured();
}

/**
 * Mint a URL the image provider can reach. Prefer the R2 public CDN URL
 * if configured (faster, free egress) and fall back to a presigned URL
 * with a 1-hour TTL -- well over the typical generation time.
 */
async function resolvePublicishUrl(key) {
  if (!key || !r2Service.isConfigured()) return null;
  const optOut = process.env.R2_USE_PUBLIC_CDN;
  const useCdn = !(optOut === '0' || optOut === 'false' || optOut === 'no');
  if (useCdn) {
    const pub = r2Service.publicUrl(key);
    if (pub) return pub;
  }
  try {
    return await r2Service.getSignedDownloadUrl(key, 3600);
  } catch {
    return null;
  }
}

async function maybeMarkImagesReady(projectId) {
  const project = await projectRepo.findById(projectId);
  if (!project) return;
  if (project.status !== 'images-pending') return;

  const scenes = await sceneRepo.findByProject(projectId);
  if (scenes.length === 0) return;

  const allHaveVariants = await Promise.all(
    scenes.map(async (s) => {
      const imgs = await sceneImageRepo.findByScene(s.id);
      return imgs.length > 0 || s.status === 'failed';
    })
  );
  if (allHaveVariants.every(Boolean)) {
    await projectRepo.updateStatus(projectId, 'images-review');
    await pubsub.publish(projectId, { phase: 'images', status: 'review' });
  }
}

function buildCharacterConsistencyContext(scenes, currentScene) {
  if (!Array.isArray(scenes) || !currentScene) return null;

  const sorted = [...scenes].sort((a, b) => (a.sceneIndex || 0) - (b.sceneIndex || 0));
  const earlier = sorted.filter(
    (s) =>
      s.id !== currentScene.id &&
      typeof s.imagePrompt === 'string' &&
      s.imagePrompt.trim() &&
      Number(s.sceneIndex) < Number(currentScene.sceneIndex)
  );
  const fallback = sorted.filter(
    (s) => s.id !== currentScene.id && typeof s.imagePrompt === 'string' && s.imagePrompt.trim()
  );

  const source = (earlier.length > 0 ? earlier : fallback).slice(-2);
  if (source.length === 0) return null;

  const anchorPrompt = source
    .map((s) => `Scene ${Number(s.sceneIndex) + 1}: ${String(s.imagePrompt || '').trim()}`)
    .join(' | ');
  return {
    anchorPrompt,
    anchorSceneIndices: source.map((s) => Number(s.sceneIndex) + 1),
  };
}

async function insertProductProcessor(job) {
  const {
    projectId,
    sceneId,
    baseSceneImageId,
    productR2Key,
    instruction = null,
    variantCount = 1,
  } = job.data || {};

  if (!projectId || !sceneId || !baseSceneImageId || !productR2Key) {
    throw new Error('insert-product job requires projectId, sceneId, baseSceneImageId, productR2Key');
  }

  const scene = await sceneRepo.findById(sceneId);
  if (!scene) throw new Error(`Scene ${sceneId} not found`);
  const project = await projectRepo.findById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const baseRow = await sceneImageRepo.findById(baseSceneImageId);
  if (!baseRow || baseRow.sceneId !== sceneId || baseRow.shotId) {
    throw new Error('Base scene image not found for this scene');
  }

  await pubsub.publish(projectId, {
    sceneId,
    phase: 'image',
    status: 'running',
  });

  try {
    const baseImageUrl = await resolvePublicishUrl(baseRow.r2Key);
    const productImageUrl = await resolvePublicishUrl(productR2Key);
    if (!baseImageUrl) throw new Error('Could not resolve URL for the selected frame');
    if (!productImageUrl) throw new Error('Could not resolve URL for the uploaded product image');

    const rawRows = await cartoonImage.generateKlingProductInsertVariants({
      projectId,
      sceneId,
      baseImageUrl,
      productImageUrl,
      scenePrompt: scene.imagePrompt || '',
      instruction: instruction || '',
      variantCount,
    });

    const existing = await sceneImageRepo.findByScene(sceneId);
    const maxIdx = existing.reduce((m, r) => Math.max(m, Number(r.variantIndex ?? 0)), -1);
    const variants = rawRows.map((row, i) => ({
      ...row,
      variantIndex: maxIdx + 1 + i,
    }));

    await sceneImageRepo.bulkCreate(sceneId, variants);

    await sceneRepo.updateStatus(sceneId, 'image-ready', null, null);
    await pubsub.publish(projectId, {
      sceneId,
      phase: 'image',
      status: 'complete',
      variantCount: variants.length,
      insertProduct: true,
    });

    try {
      if (r2Service.isConfigured()) await r2Service.delete(productR2Key);
    } catch (_) {
      /* best-effort cleanup of temp packshot */
    }

    await maybeMarkImagesReady(projectId);
    return { sceneId, variantCount: variants.length, insertProduct: true };
  } catch (err) {
    const errorCode = cartoonImage.classifyImageError(err.message);
    const maxAttempts = Math.max(1, Number(job.opts.attempts) || 1);
    const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

    if (isFinalAttempt) {
      await sceneRepo.updateStatus(sceneId, 'failed', err.message, errorCode);
      await pubsub.publish(projectId, {
        sceneId,
        phase: 'image',
        status: 'failed',
        error: err.message,
        errorCode,
      });
      try {
        if (r2Service.isConfigured()) await r2Service.delete(productR2Key);
      } catch (_) {
        /* ignore */
      }
    } else {
      await pubsub.publish(projectId, {
        sceneId,
        phase: 'image',
        status: 'retrying',
        attempt: job.attemptsMade + 1,
        maxAttempts,
        error: err.message,
      });
    }

    await maybeMarkImagesReady(projectId);
    throw err;
  }
}

module.exports = async function sceneImagesProcessor(job) {
  if (job.name === 'insert-product') {
    return insertProductProcessor(job);
  }

  const {
    projectId,
    sceneId,
    variantCount = 3,
    clearExisting = false,
    customPrompt = null,
  } = job.data;

  if (!projectId || !sceneId) throw new Error('projectId and sceneId required');

  const scene = await sceneRepo.findById(sceneId);
  if (!scene) throw new Error(`Scene ${sceneId} not found`);
  const project = await projectRepo.findById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const style = project.styleId ? await styleRepo.findById(project.styleId) : null;
  const prompt = customPrompt || scene.imagePrompt;
  const projectScenes = await sceneRepo.findByProject(projectId);
  const characterConsistency = buildCharacterConsistencyContext(projectScenes, scene);

  await pubsub.publish(projectId, {
    sceneId, phase: 'image', status: 'running',
  });

  try {
    if (clearExisting) {
      await sceneImageRepo.deleteForScene(sceneId);
      await sceneRepo.updateSelectedImage(sceneId, null);
    }

    const productReferenceUrl = await resolvePublicishUrl(scene.productReferenceKey);

    // Project-level character reference images (Step 1 uploads). Sent to
    // Fal as additional `image_urls` on nano-banana-2/edit so generated
    // scenes inherit the user's chosen character / aesthetic. Cap at 4
    // to keep the request payload sane.
    const visualReferenceRows = await projectVisualReferenceRepo.findByProject(projectId);
    const characterReferenceUrls = [];
    for (const ref of visualReferenceRows.slice(0, 4)) {
      const url = await resolvePublicishUrl(ref.r2Key);
      if (url) characterReferenceUrls.push(url);
    }

    let productCustomReferenceId = scene.productCustomReferenceId || null;
    if (
      productReferenceUrl &&
      higgsfieldIsPrimaryProvider(project.imageModelSettings) &&
      !productCustomReferenceId
    ) {
      try {
        productCustomReferenceId = await higgsfield.createCustomReferenceFromImageUrl({
          imageUrl: productReferenceUrl,
          name: `product-${projectId}-${sceneId}`.slice(0, 200),
        });
        await sceneRepo.setProductCustomReferenceId(sceneId, productCustomReferenceId);
      } catch (err) {
        console.warn(
          `[sceneImages] Soul ID registration failed (e.g. Higgsfield credits); Fal fallback still receives the product via Nano Banana Edit when applicable: ${err.message}`
        );
      }
    }

    const variants = await cartoonImage.generateSceneVariants({
      projectId,
      sceneId,
      prompt,
      style,
      variantCount,
      imageModelSettings: project.imageModelSettings || {},
      productReferenceUrl,
      productCustomReferenceId,
      characterReferenceUrls,
      characterConsistency,
    });

    await sceneImageRepo.bulkCreate(sceneId, variants);

    // No auto-selection. The user must explicitly pick a variant -- the
    // old behaviour silently picked variant[0] and made the project look
    // "ready to generate" without any user input.
    await sceneRepo.updateStatus(sceneId, 'image-ready', null, null);
    await pubsub.publish(projectId, {
      sceneId, phase: 'image', status: 'complete', variantCount: variants.length,
    });

    await maybeMarkImagesReady(projectId);

    return { sceneId, variantCount: variants.length };
  } catch (err) {
    const errorCode = cartoonImage.classifyImageError(err.message);
    // Bull increments attemptsMade only after the processor throws (inside
    // moveToFailed). While waiting for backoff retries, the scene must stay
    // non-failed or the UI shows "Image generation failed" even though the
    // job will run again.
    const maxAttempts = Math.max(1, Number(job.opts.attempts) || 1);
    const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

    if (isFinalAttempt) {
      await sceneRepo.updateStatus(sceneId, 'failed', err.message, errorCode);
      await pubsub.publish(projectId, {
        sceneId,
        phase: 'image',
        status: 'failed',
        error: err.message,
        errorCode,
      });
    } else {
      await pubsub.publish(projectId, {
        sceneId,
        phase: 'image',
        status: 'retrying',
        attempt: job.attemptsMade + 1,
        maxAttempts,
        error: err.message,
      });
    }

    // Only treat the scene as "done" for project-level gates once it has
    // variants or is finally marked failed (after all retries).
    await maybeMarkImagesReady(projectId);

    throw err;
  }
};
