/**
 * When a storyboard still changes for one scene/shot, drop only that clip's
 * Seedance output and the assembled final MP4. Other scenes keep their
 * video keys; the user regenerates i2v for the stale row(s) then re-approves
 * assembly (concat uses whatever keys are current in the DB).
 */

const projectRepo = require('../db/repositories/projectRepo');
const sceneRepo = require('../db/repositories/sceneRepo');
const shotRepo = require('../db/repositories/shotRepo');
const pubsub = require('./pubsubService');
const { queues } = require('../queues/cartoonQueues');

/** Project already had (or is in) the video pipeline — re-queue Seedance for one scene. */
const VIDEO_PIPELINE_STATUSES = new Set([
  'videos-review',
  'generating',
  'assembling',
  'complete',
  'failed',
]);

async function enqueueSceneVideoIfNeeded(projectId, sceneId) {
  const project = await projectRepo.findById(projectId);
  const scene = await sceneRepo.findById(sceneId);
  if (!project || !scene || scene.projectId !== projectId) return false;
  if (scene.multiShotEnabled) return false;
  if (!VIDEO_PIPELINE_STATUSES.has(project.status)) return false;
  if (!scene.selectedImageId || !scene.voiceKey) return false;
  if (scene.videoKey) return false;

  await queues.seedanceVideo.add('submit', { projectId, sceneId });
  await pubsub.publish(projectId, { sceneId, phase: 'video', status: 'requeued' });
  if (project.status !== 'generating') {
    await projectRepo.updateStatus(projectId, 'generating', null);
  }
  return true;
}

async function stripAssembledFinalIfAny(projectId) {
  const project = await projectRepo.findById(projectId);
  if (!project?.outputKey) return;
  await projectRepo.update(projectId, { outputKey: null });
  if (project.status === 'complete' || project.status === 'assembling') {
    await projectRepo.updateStatus(projectId, 'videos-review', null);
  }
}

/**
 * Single-shot scene: new still selection / upload / regenerate-before-variants.
 */
async function afterSingleShotSceneStillChanged(projectId, sceneId) {
  const scene = await sceneRepo.findById(sceneId);
  if (!scene || scene.projectId !== projectId || scene.multiShotEnabled) return;
  await sceneRepo.clearSceneVideo(sceneId);
  await stripAssembledFinalIfAny(projectId);
  await enqueueSceneVideoIfNeeded(projectId, sceneId);
}

/**
 * Multi-shot scene only: legacy `scenes.video_key` is not used in final concat
 * (shots are), but clear it if present so UI/state stay consistent.
 */
async function afterMultiShotSceneLegacyVideoOnly(projectId, sceneId) {
  const scene = await sceneRepo.findById(sceneId);
  if (!scene || scene.projectId !== projectId || !scene.multiShotEnabled) return;
  if (!scene.videoKey) return;
  await sceneRepo.clearSceneVideo(sceneId);
}

/**
 * One shot in a multi-shot scene: different still or shot image regen.
 */
async function afterShotStillChanged(projectId, shotId) {
  const shot = await shotRepo.findById(shotId);
  if (!shot) return;
  const scene = await sceneRepo.findById(shot.sceneId);
  if (!scene || scene.projectId !== projectId) return;
  await shotRepo.clearShotVideo(shotId);
  await stripAssembledFinalIfAny(projectId);
}

module.exports = {
  afterSingleShotSceneStillChanged,
  afterMultiShotSceneLegacyVideoOnly,
  afterShotStillChanged,
  stripAssembledFinalIfAny,
  enqueueSceneVideoIfNeeded,
};
