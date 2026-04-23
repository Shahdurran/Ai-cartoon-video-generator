/**
 * Seedance image-to-video processor.
 *
 * Two job types on the same queue:
 *   'submit'      -> submit to Fal.AI, schedule first poll
 *   'poll'        -> check status, either complete or re-schedule poll
 *
 * Job data shape:
 *   submit: { projectId, sceneId }
 *   poll:   { projectId, sceneId, requestId, modelId, pollCount, startedAt }
 *
 * Max poll duration: ~30 minutes (120 polls at 15s).
 */

const path = require('path');
const os = require('os');
const fs = require('fs-extra');

const falVideo = require('../../../services/falVideoService');
const r2Service = require('../../../services/r2Service');
const sceneRepo = require('../../../db/repositories/sceneRepo');
const sceneImageRepo = require('../../../db/repositories/sceneImageRepo');
const projectRepo = require('../../../db/repositories/projectRepo');
const pubsub = require('../../../services/pubsubService');
const { queues } = require('../../cartoonQueues');

const MAX_POLLS = 120; // * 15s = 30 min
const POLL_INTERVAL_MS = 15_000;

async function handleSubmit(job) {
  const { projectId, sceneId } = job.data;
  const scene = await sceneRepo.findById(sceneId);
  if (!scene) throw new Error(`Scene ${sceneId} not found`);

  if (!scene.selectedImageId) {
    throw new Error(`Scene ${sceneId} has no selected image`);
  }
  const image = await sceneImageRepo.findById(scene.selectedImageId);
  if (!image) throw new Error(`Selected image ${scene.selectedImageId} not found`);

  const imageUrl = r2Service.isConfigured()
    ? await r2Service.getSignedDownloadUrl(image.r2Key, 3600)
    : image.r2Key;

  await pubsub.publish(projectId, { sceneId, phase: 'video', status: 'submitting' });

  const { requestId, modelId } = await falVideo.submit({
    imageUrl,
    prompt: scene.imagePrompt,
    duration: Math.min(10, Math.max(3, Math.round(Number(scene.durationSeconds) || 5))),
  });

  await sceneRepo.setFalRequestId(sceneId, requestId);
  await pubsub.publish(projectId, { sceneId, phase: 'video', status: 'queued', requestId });

  // Schedule first poll.
  await queues.seedanceVideo.add('poll', {
    projectId,
    sceneId,
    requestId,
    modelId,
    pollCount: 0,
    startedAt: Date.now(),
  }, { delay: POLL_INTERVAL_MS });

  return { submitted: true, requestId };
}

async function handlePoll(job) {
  const { projectId, sceneId, requestId, modelId, pollCount = 0 } = job.data;

  if (pollCount > MAX_POLLS) {
    await sceneRepo.updateStatus(sceneId, 'failed', 'Seedance poll timed out');
    await pubsub.publish(projectId, { sceneId, phase: 'video', status: 'failed', error: 'timeout' });
    throw new Error('Seedance poll timeout');
  }

  let status;
  try {
    status = await falVideo.getStatus({ requestId, modelId });
  } catch (err) {
    // Transient error -- retry.
    await queues.seedanceVideo.add('poll', {
      ...job.data,
      pollCount: pollCount + 1,
    }, { delay: POLL_INTERVAL_MS });
    return { polled: true, transientError: err.message };
  }

  const phase = status?.status || status; // SDK returns object with 'status' field

  if (phase === 'IN_QUEUE' || phase === 'IN_PROGRESS') {
    await pubsub.publish(projectId, {
      sceneId, phase: 'video', status: 'polling', pollCount, fal: phase,
    });
    await queues.seedanceVideo.add('poll', {
      ...job.data,
      pollCount: pollCount + 1,
    }, { delay: POLL_INTERVAL_MS });
    return { polled: true, pollCount: pollCount + 1 };
  }

  if (phase === 'COMPLETED') {
    try {
      const { videoUrl } = await falVideo.getResult({ requestId, modelId });
      const localTmp = path.join(os.tmpdir(), `seedance-${sceneId}-${Date.now()}.mp4`);
      await falVideo.downloadVideo(videoUrl, localTmp);

      const r2Key = r2Service.keys.sceneVideo(projectId, sceneId);
      if (r2Service.isConfigured()) {
        await r2Service.uploadFromPath(r2Key, localTmp, 'video/mp4');
      }
      await sceneRepo.setVideoKey(sceneId, r2Key);
      await fs.remove(localTmp).catch(() => {});

      await pubsub.publish(projectId, { sceneId, phase: 'video', status: 'complete' });

      // Check if all scenes are video-ready -- if so, kick off final assembly.
      await maybeKickoffFinalAssembly(projectId);

      return { completed: true, r2Key };
    } catch (err) {
      await sceneRepo.updateStatus(sceneId, 'failed', err.message);
      await pubsub.publish(projectId, { sceneId, phase: 'video', status: 'failed', error: err.message });
      throw err;
    }
  }

  // Any other terminal state (FAILED, CANCELLED, etc.) => error out.
  const errorMsg = `Seedance returned terminal state: ${phase}`;
  await sceneRepo.updateStatus(sceneId, 'failed', errorMsg);
  await pubsub.publish(projectId, { sceneId, phase: 'video', status: 'failed', error: errorMsg });
  throw new Error(errorMsg);
}

async function maybeKickoffFinalAssembly(projectId) {
  const project = await projectRepo.findById(projectId);
  if (!project) return;
  if (project.status === 'complete' || project.status === 'assembling') return;

  const readyCount = await sceneRepo.countByStatus(projectId, 'video-ready');
  if (readyCount < project.sceneCount) return;

  // Kick off subtitles (if not already generated) and final assembly in sequence.
  if (!project.subtitlesKey) {
    await queues.projectSubtitles.add('generate', { projectId });
  }
  await projectRepo.updateStatus(projectId, 'assembling');
  await queues.finalAssembly.add('assemble', { projectId });
}

module.exports = async function seedanceProcessor(job) {
  if (job.name === 'submit') return handleSubmit(job);
  if (job.name === 'poll') return handlePoll(job);
  throw new Error(`Unknown seedance job name: ${job.name}`);
};

module.exports.maybeKickoffFinalAssembly = maybeKickoffFinalAssembly;
