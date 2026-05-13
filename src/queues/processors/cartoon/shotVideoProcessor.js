/**
 * Per-shot Seedance image-to-video processor.
 *
 * Mirror of seedanceProcessor.js but keyed on a shot inside a multi-shot
 * scene. The selected_image_id on the shot row drives the input image; the
 * shot's image_prompt drives the motion prompt; the project's video model
 * settings still apply (Seedance 1.0/2.0).
 *
 * Job names:
 *   'submit' -> submit to Fal, schedule first poll
 *   'poll'   -> check status, complete or re-poll
 */

const path = require('path');
const os = require('os');
const fs = require('fs-extra');

const falVideo = require('../../../services/falVideoService');
const r2Service = require('../../../services/r2Service');
const sceneRepo = require('../../../db/repositories/sceneRepo');
const sceneImageRepo = require('../../../db/repositories/sceneImageRepo');
const projectRepo = require('../../../db/repositories/projectRepo');
const shotRepo = require('../../../db/repositories/shotRepo');
const pubsub = require('../../../services/pubsubService');
const { queues } = require('../../cartoonQueues');

const MAX_POLLS = 120;
const POLL_INTERVAL_MS = 15_000;

async function handleSubmit(job) {
  const { projectId, sceneId, shotId } = job.data;

  const shot = await shotRepo.findById(shotId);
  if (!shot) throw new Error(`Shot ${shotId} not found`);
  if (!shot.selectedImageId) throw new Error(`Shot ${shotId} has no selected image`);

  const image = await sceneImageRepo.findById(shot.selectedImageId);
  if (!image) throw new Error(`Selected image ${shot.selectedImageId} not found`);

  const project = await projectRepo.findById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const imageUrl = r2Service.isConfigured()
    ? await r2Service.getSignedDownloadUrl(image.r2Key, 3600)
    : image.r2Key;

  await pubsub.publish(projectId, {
    sceneId, shotId, phase: 'shot-video', status: 'submitting',
  });

  let requestId;
  let modelId;
  try {
    const res = await falVideo.submit({
      imageUrl,
      prompt: shot.imagePrompt,
      projectVideoSettings: project.videoModelSettings || {},
      // Per-shot duration is the target window length; keep it short so
      // Seedance doesn't try to fit long motion into a 2.5s cut. Round
      // up to the model's minimum (Seedance 1.0 Pro = 2s).
      sceneDurationSeconds: Math.max(2, Math.round(Number(shot.durationSeconds) || 3)),
    });
    requestId = res.requestId;
    modelId = res.modelId;
  } catch (err) {
    const msg = err?.message || String(err);
    console.error(`[shotVideo/submit] FAILED scene=${sceneId} shot=${shotId}:`, msg);
    await shotRepo.updateStatus(shotId, 'failed', msg);
    await pubsub.publish(projectId, {
      sceneId, shotId, phase: 'shot-video', status: 'failed', error: msg,
    });
    await maybeMarkVideosReady(projectId);
    throw err;
  }

  await shotRepo.setFalRequestId(shotId, requestId);
  await pubsub.publish(projectId, {
    sceneId, shotId, phase: 'shot-video', status: 'queued', requestId,
  });

  await queues.shotVideo.add('poll', {
    projectId, sceneId, shotId, requestId, modelId, pollCount: 0, startedAt: Date.now(),
  }, { delay: POLL_INTERVAL_MS });

  return { submitted: true, requestId };
}

async function handlePoll(job) {
  const { projectId, sceneId, shotId, requestId, modelId, pollCount = 0 } = job.data;

  if (pollCount > MAX_POLLS) {
    await shotRepo.updateStatus(shotId, 'failed', 'Seedance poll timed out');
    await pubsub.publish(projectId, {
      sceneId, shotId, phase: 'shot-video', status: 'failed', error: 'timeout',
    });
    await maybeMarkVideosReady(projectId);
    throw new Error('Seedance poll timeout');
  }

  let status;
  try {
    status = await falVideo.getStatus({ requestId, modelId });
  } catch (err) {
    await queues.shotVideo.add('poll', {
      ...job.data, pollCount: pollCount + 1,
    }, { delay: POLL_INTERVAL_MS });
    return { polled: true, transientError: err.message };
  }

  const phase = status?.status || status;

  if (phase === 'IN_QUEUE' || phase === 'IN_PROGRESS') {
    await pubsub.publish(projectId, {
      sceneId, shotId, phase: 'shot-video', status: 'polling', pollCount, fal: phase,
    });
    await queues.shotVideo.add('poll', {
      ...job.data, pollCount: pollCount + 1,
    }, { delay: POLL_INTERVAL_MS });
    return { polled: true, pollCount: pollCount + 1 };
  }

  if (phase === 'COMPLETED') {
    try {
      const { videoUrl } = await falVideo.getResult({ requestId, modelId });
      const localTmp = path.join(os.tmpdir(), `seedance-shot-${shotId}-${Date.now()}.mp4`);
      await falVideo.downloadVideo(videoUrl, localTmp);

      const r2Key = r2Service.keys.shotVideo(projectId, sceneId, shotId);
      if (r2Service.isConfigured()) {
        await r2Service.uploadFromPath(r2Key, localTmp, 'video/mp4');
      }
      await shotRepo.setVideoKey(shotId, r2Key);
      await fs.remove(localTmp).catch(() => {});

      await pubsub.publish(projectId, {
        sceneId, shotId, phase: 'shot-video', status: 'complete',
      });

      await maybeMarkVideosReady(projectId);
      return { completed: true, r2Key };
    } catch (err) {
      await shotRepo.updateStatus(shotId, 'failed', err.message);
      await pubsub.publish(projectId, {
        sceneId, shotId, phase: 'shot-video', status: 'failed', error: err.message,
      });
      await maybeMarkVideosReady(projectId);
      throw err;
    }
  }

  const detail = status?.error || status?.detail || status?.data?.error;
  const errorMsg =
    typeof detail === 'string' && detail.trim()
      ? detail.trim()
      : typeof detail === 'object' && detail
        ? JSON.stringify(detail)
        : `Seedance terminal: ${phase}`;
  await shotRepo.updateStatus(shotId, 'failed', errorMsg);
  await pubsub.publish(projectId, {
    sceneId, shotId, phase: 'shot-video', status: 'failed', error: errorMsg,
  });
  await maybeMarkVideosReady(projectId);
  throw new Error(errorMsg);
}

/**
 * Project-level "every render done" gate. Considers BOTH single-shot
 * scenes (scene.video_key) AND multi-shot scenes (every shot has video_key
 * or is failed). Mirrors seedanceProcessor.maybeMarkVideosReady but with
 * shot awareness so a project mixing single-shot + multi-shot scenes
 * doesn't stall on the videos-review gate.
 */
async function maybeMarkVideosReady(projectId) {
  const project = await projectRepo.findById(projectId);
  if (!project) return;
  if (
    project.status === 'complete' ||
    project.status === 'assembling' ||
    project.status === 'videos-review'
  ) {
    return;
  }

  const scenes = await sceneRepo.findByProject(projectId);
  if (scenes.length === 0) return;

  for (const scene of scenes) {
    if (!scene.multiShotEnabled) {
      if (!scene.videoKey && scene.status !== 'failed') return;
      continue;
    }
    const shots = await shotRepo.findByScene(scene.id);
    if (shots.length === 0) return;
    for (const shot of shots) {
      if (!shot.videoKey && shot.status !== 'failed') return;
    }
  }

  await projectRepo.updateStatus(projectId, 'videos-review');
  await pubsub.publish(projectId, { phase: 'videos', status: 'review' });
}

module.exports = async function shotVideoProcessor(job) {
  if (job.name === 'submit') return handleSubmit(job);
  if (job.name === 'poll') return handlePoll(job);
  throw new Error(`Unknown shotVideo job name: ${job.name}`);
};

module.exports.maybeMarkVideosReady = maybeMarkVideosReady;
