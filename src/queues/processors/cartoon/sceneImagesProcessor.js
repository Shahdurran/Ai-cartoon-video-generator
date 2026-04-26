/**
 * Scene images processor -- generates 3-4 Flux variants for a single scene
 * and uploads them to R2.
 *
 * Job data:
 *   { projectId, sceneId, prompt?, variantCount=3, clearExisting=false, customPrompt? }
 *
 * If `customPrompt` is supplied, it replaces the scene's prompt for this
 * run (used by POST /scenes/:id/regenerate-image).
 */

const cartoonImage = require('../../../services/cartoonImageService');
const sceneRepo = require('../../../db/repositories/sceneRepo');
const sceneImageRepo = require('../../../db/repositories/sceneImageRepo');
const projectRepo = require('../../../db/repositories/projectRepo');
const styleRepo = require('../../../db/repositories/styleRepo');
const pubsub = require('../../../services/pubsubService');

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

module.exports = async function sceneImagesProcessor(job) {
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

  await pubsub.publish(projectId, {
    sceneId, phase: 'image', status: 'running',
  });

  try {
    if (clearExisting) {
      await sceneImageRepo.deleteForScene(sceneId);
      await sceneRepo.updateSelectedImage(sceneId, null);
    }

    const variants = await cartoonImage.generateSceneVariants({
      projectId,
      sceneId,
      prompt,
      style,
      variantCount,
      imageModelSettings: project.imageModelSettings || {},
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
    await sceneRepo.updateStatus(sceneId, 'failed', err.message, errorCode);
    await pubsub.publish(projectId, {
      sceneId,
      phase: 'image',
      status: 'failed',
      error: err.message,
      errorCode,
    });

    // Even on failure, check whether the rest of the project's scenes are
    // done -- otherwise a single failed scene leaves the project stuck in
    // 'images-pending' forever.
    await maybeMarkImagesReady(projectId);

    throw err;
  }
};
