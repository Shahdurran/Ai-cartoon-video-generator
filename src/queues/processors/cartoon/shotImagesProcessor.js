/**
 * Shot images processor -- generates Flux/Nano-Banana variants for ONE shot
 * inside a multi-shot scene and uploads them to R2.
 *
 * Shots inherit their parent scene's product reference + character anchor
 * (existing prompts of other scenes are still folded in as additional
 * context). The shot's own image_prompt drives the framing/angle.
 *
 * Job data:
 *   { projectId, sceneId, shotId, variantCount=3, clearExisting=false, customPrompt? }
 */

const cartoonImage = require('../../../services/cartoonImageService');
const sceneRepo = require('../../../db/repositories/sceneRepo');
const sceneImageRepo = require('../../../db/repositories/sceneImageRepo');
const projectRepo = require('../../../db/repositories/projectRepo');
const projectVisualReferenceRepo = require('../../../db/repositories/projectVisualReferenceRepo');
const styleRepo = require('../../../db/repositories/styleRepo');
const shotRepo = require('../../../db/repositories/shotRepo');
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

/**
 * Build a stronger character-consistency anchor than the generic per-scene
 * one: a multi-shot scene's shots MUST share the same character/setting,
 * so we anchor on the parent scene's main image prompt + neighbouring
 * scenes' prompts.
 */
function buildShotConsistency(scene, otherScenes) {
  const anchorParts = [];
  if (scene?.imagePrompt) {
    anchorParts.push(`Same scene (this scene's master shot): ${String(scene.imagePrompt).trim()}`);
  }
  const neighbours = (otherScenes || [])
    .filter((s) => s.id !== scene.id && typeof s.imagePrompt === 'string' && s.imagePrompt.trim())
    .slice(0, 2);
  for (const n of neighbours) {
    anchorParts.push(`Scene ${Number(n.sceneIndex) + 1}: ${String(n.imagePrompt).trim()}`);
  }
  if (anchorParts.length === 0) return null;
  return {
    anchorPrompt: anchorParts.join(' | '),
    anchorSceneIndices: [Number(scene.sceneIndex) + 1],
  };
}

/**
 * After every shot of every multi-shot scene has variants (or has failed),
 * flip project status to 'shot-images-review'. Single-shot scenes don't
 * need their own gate -- they were already approved at the images-review
 * step before the user opted any scene into multi-shot.
 */
async function maybeMarkShotImagesReady(projectId) {
  const project = await projectRepo.findById(projectId);
  if (!project) return;
  if (project.status !== 'shot-images-pending') return;

  const allScenes = await sceneRepo.findByProject(projectId);
  const multiScenes = allScenes.filter((s) => s.multiShotEnabled);
  if (multiScenes.length === 0) return;

  for (const scene of multiScenes) {
    const shots = await shotRepo.findByScene(scene.id);
    if (shots.length === 0) return; // not yet bootstrapped
    for (const shot of shots) {
      const variants = await sceneImageRepo.findByShot(shot.id);
      if (variants.length === 0 && shot.status !== 'failed') {
        return; // still waiting on this shot
      }
    }
  }

  await projectRepo.updateStatus(projectId, 'shot-images-review');
  await pubsub.publish(projectId, { phase: 'shot-images', status: 'review' });
}

module.exports = async function shotImagesProcessor(job) {
  const {
    projectId,
    sceneId,
    shotId,
    variantCount = 3,
    clearExisting = false,
    customPrompt = null,
  } = job.data;

  if (!projectId || !sceneId || !shotId) {
    throw new Error('projectId, sceneId, and shotId are required');
  }

  const shot = await shotRepo.findById(shotId);
  if (!shot) throw new Error(`Shot ${shotId} not found`);

  const scene = await sceneRepo.findById(sceneId);
  if (!scene) throw new Error(`Scene ${sceneId} not found`);

  const project = await projectRepo.findById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  // Locked shots reuse the scene's approved variant. Make sure that bond
  // is current and mark the shot ready, then advance the project-level
  // gate. We never call the image model for these.
  if (shotRepo.isLockedShot(shot)) {
    if (scene.selectedImageId) {
      await shotRepo.updateSelectedImage(shotId, scene.selectedImageId);
    }
    await shotRepo.updateStatus(shotId, 'image-ready', null, null);
    await pubsub.publish(projectId, {
      sceneId,
      shotId,
      phase: 'shot-image',
      status: 'complete',
      variantCount: 0,
      reusedApprovedSceneImage: true,
    });
    await maybeMarkShotImagesReady(projectId);
    return { shotId, variantCount: 0, reusedApprovedSceneImage: true };
  }

  const style = project.styleId ? await styleRepo.findById(project.styleId) : null;
  const prompt = customPrompt || shot.imagePrompt;
  const otherScenes = await sceneRepo.findByProject(projectId);
  const characterConsistency = buildShotConsistency(scene, otherScenes);

  await pubsub.publish(projectId, {
    sceneId,
    shotId,
    phase: 'shot-image',
    status: 'running',
  });

  try {
    if (clearExisting) {
      await sceneImageRepo.deleteForShot(shotId);
      await shotRepo.updateSelectedImage(shotId, null);
    }

    const productReferenceUrl = await resolvePublicishUrl(scene.productReferenceKey);

    // Project-level character reference images (Step 1 uploads). Same
    // anchor used by sceneImagesProcessor so the multi-shot variants
    // match the single-shot scene image they were carved out of.
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
          `[shotImages] Soul ID registration skipped: ${err.message}`
        );
      }
    }

    // Reuse the scene-level image cascade. The generator writes to
    // R2 under the standard sceneImage key; we override the key here so
    // shot variants live under projects/<id>/scenes/<sid>/shots/<shotid>/.
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
      r2KeyBuilder: (variantIndex, ext) =>
        r2Service.keys.shotImage(projectId, sceneId, shotId, variantIndex, ext),
    });

    await sceneImageRepo.bulkCreate(sceneId, variants, { shotId });
    await shotRepo.updateStatus(shotId, 'image-ready', null, null);

    await pubsub.publish(projectId, {
      sceneId,
      shotId,
      phase: 'shot-image',
      status: 'complete',
      variantCount: variants.length,
    });

    await maybeMarkShotImagesReady(projectId);
    return { shotId, variantCount: variants.length };
  } catch (err) {
    const errorCode = cartoonImage.classifyImageError(err.message);
    const maxAttempts = Math.max(1, Number(job.opts.attempts) || 1);
    const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

    if (isFinalAttempt) {
      await shotRepo.updateStatus(shotId, 'failed', err.message, errorCode);
      await pubsub.publish(projectId, {
        sceneId,
        shotId,
        phase: 'shot-image',
        status: 'failed',
        error: err.message,
        errorCode,
      });
    } else {
      await pubsub.publish(projectId, {
        sceneId,
        shotId,
        phase: 'shot-image',
        status: 'retrying',
        attempt: job.attemptsMade + 1,
        maxAttempts,
        error: err.message,
      });
    }

    await maybeMarkShotImagesReady(projectId);
    throw err;
  }
};

module.exports.maybeMarkShotImagesReady = maybeMarkShotImagesReady;
