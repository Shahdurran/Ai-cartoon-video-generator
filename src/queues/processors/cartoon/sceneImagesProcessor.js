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
    });

    await sceneImageRepo.bulkCreate(sceneId, variants);

    // Auto-select the first variant so the user can go straight to review.
    const imageRows = await sceneImageRepo.findByScene(sceneId);
    if (imageRows.length > 0 && !scene.selectedImageId) {
      await sceneRepo.updateSelectedImage(sceneId, imageRows[0].id);
    }

    await sceneRepo.updateStatus(sceneId, 'image-ready');
    await pubsub.publish(projectId, {
      sceneId, phase: 'image', status: 'complete', variantCount: variants.length,
    });

    return { sceneId, variantCount: variants.length };
  } catch (err) {
    await sceneRepo.updateStatus(sceneId, 'failed', err.message);
    await pubsub.publish(projectId, {
      sceneId, phase: 'image', status: 'failed', error: err.message,
    });
    throw err;
  }
};
