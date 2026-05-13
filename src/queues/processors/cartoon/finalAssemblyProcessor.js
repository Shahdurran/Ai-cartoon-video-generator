/**
 * Final assembly processor. Downloads scene clips + subtitles + music from
 * R2, runs FFmpeg concat + color grade + subtitle burn + music mix, uploads
 * the final MP4 back to R2.
 *
 * Job data: { projectId }
 */

const assembler = require('../../../services/cartoonAssemblerService');
const sceneRepo = require('../../../db/repositories/sceneRepo');
const shotRepo = require('../../../db/repositories/shotRepo');
const projectRepo = require('../../../db/repositories/projectRepo');
const styleRepo = require('../../../db/repositories/styleRepo');
const musicTrackRepo = require('../../../db/repositories/musicTrackRepo');
const r2Service = require('../../../services/r2Service');
const pubsub = require('../../../services/pubsubService');
const subtitlesProcessor = require('./projectSubtitlesProcessor');

module.exports = async function finalAssemblyProcessor(job) {
  const { projectId } = job.data;
  if (!projectId) throw new Error('projectId required');

  await pubsub.publish(projectId, { phase: 'assembly', status: 'running' });

  try {
    let project = await projectRepo.findById(projectId);
    if (!project) throw new Error('Project not found');

    const scenes = await sceneRepo.findByProject(projectId);

    // Build a per-scene plan. Multi-shot scenes contribute their shot
    // video keys; single-shot scenes contribute their scenes.video_key.
    // Either way every scene must end up with at least one usable video
    // input or assembly bails early.
    const scenePlans = [];
    for (const scene of scenes) {
      if (scene.multiShotEnabled) {
        const shots = await shotRepo.findByScene(scene.id);
        const usable = shots.filter((sh) => !!sh.videoKey);
        if (usable.length === 0) {
          throw new Error(`Multi-shot scene ${scene.sceneIndex + 1} has no rendered shots`);
        }
        scenePlans.push({
          shots: usable.map((sh) => ({
            videoKey: sh.videoKey,
            durationSeconds: Number(sh.durationSeconds) || 2.5,
          })),
        });
      } else {
        if (!scene.videoKey) {
          throw new Error(`Scene ${scene.sceneIndex + 1} is missing videoKey`);
        }
        scenePlans.push(null);
      }
    }

    // Build the legacy parallel array of scene-level video keys. For
    // multi-shot scenes we hand the assembler the FIRST shot's key as a
    // placeholder -- the assembler ignores it when scenePlans[i] is set,
    // it just needs the array length to match for downstream voice and
    // subtitle indexing.
    const sceneVideoKeys = scenes.map((s, i) => {
      if (s.videoKey) return s.videoKey;
      const plan = scenePlans[i];
      return plan?.shots?.[0]?.videoKey || null;
    });

    // Always rebuild the combined SRT before final concat whenever any
    // scene has voice. That way a failed first attempt (bad key, rate
    // limit) is retried on re-assemble, and timings stay aligned with the
    // current voice MP3s after any voice re-gen.
    const hasAnyVoice = scenes.some((s) => !!s.voiceKey);
    if (hasAnyVoice) {
      try {
        console.log(`📝 [assembly] Generating subtitles for project ${projectId} (AssemblyAI)…`);
        await subtitlesProcessor({ data: { projectId } });
        project = await projectRepo.findById(projectId);
        if (project.subtitlesKey) {
          console.log(`✅ [assembly] Subtitles ready: ${project.subtitlesKey}`);
        }
      } catch (err) {
        const detail = err.message?.includes('Authentication')
          ? 'Subtitles skipped: ASSEMBLYAI_API_KEY is missing or invalid. Put it in the repo-root .env (not web/.env.local), restart the backend, then re-assemble.'
          : `Subtitles skipped: ${err.message}`;
        console.warn(`⚠️  ${detail}`);
        await pubsub.publish(projectId, {
          phase: 'subtitles',
          status: 'failed',
          error: detail,
        });
      }
    } else {
      console.log('📝 [assembly] No voice on any scene — skipping subtitles.');
    }

    const style = project.styleId ? await styleRepo.findById(project.styleId) : null;
    const music = project.musicTrackId
      ? await musicTrackRepo.findById(project.musicTrackId)
      : null;

    const outputKey = r2Service.keys.finalVideo(projectId);

    const { tmpDir } = await assembler.assembleFinalVideo({
      projectId,
      sceneVideoKeys,
      scenePlans,
      sceneVoiceKeys: scenes.map((s) => s.voiceKey || null),
      subtitlesKey: project.subtitlesKey || null,
      musicKey: music?.r2Key || null,
      musicVolume: Number(project.musicVolume) || 0.15,
      subtitleSettings: project.subtitleSettings || {},
      colorGrade: style?.ffmpegColorGrade || null,
      outputKey,
    });

    await projectRepo.update(projectId, { outputKey });
    await projectRepo.updateStatus(projectId, 'complete');

    await pubsub.publish(projectId, { phase: 'assembly', status: 'complete', outputKey });

    // Clean up the tmp dir after success.
    if (tmpDir) await assembler.cleanupTmpDir(tmpDir);

    return { outputKey };
  } catch (err) {
    const detail = err.tmpDir ? `${err.message}\n(working dir kept for debugging: ${err.tmpDir})` : err.message;
    await projectRepo.updateStatus(projectId, 'failed', detail);
    await pubsub.publish(projectId, { phase: 'assembly', status: 'failed', error: detail });
    throw err;
  }
};
