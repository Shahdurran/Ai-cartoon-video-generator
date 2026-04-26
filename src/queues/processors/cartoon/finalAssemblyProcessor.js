/**
 * Final assembly processor. Downloads scene clips + subtitles + music from
 * R2, runs FFmpeg concat + color grade + subtitle burn + music mix, uploads
 * the final MP4 back to R2.
 *
 * Job data: { projectId }
 */

const assembler = require('../../../services/cartoonAssemblerService');
const sceneRepo = require('../../../db/repositories/sceneRepo');
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
    const missing = scenes.filter((s) => !s.videoKey);
    if (missing.length > 0) {
      throw new Error(`${missing.length} scene(s) still missing videoKey`);
    }

    // Build subtitles inline if they don't exist yet so we don't race the
    // separate subtitles queue. Skipped silently if no scene has voice.
    const hasAnyVoice = scenes.some((s) => !!s.voiceKey);
    if (!project.subtitlesKey && hasAnyVoice) {
      try {
        console.log(`📝 [assembly] Generating subtitles for project ${projectId} (AssemblyAI)…`);
        await subtitlesProcessor({ data: { projectId } });
        // Reload so subtitlesKey is fresh on the project record.
        project = await projectRepo.findById(projectId);
        if (project.subtitlesKey) {
          console.log(`✅ [assembly] Subtitles ready: ${project.subtitlesKey}`);
        }
      } catch (err) {
        // Surface the failure as a visible warning on the project so the
        // user can see *why* their captions are missing from the final
        // cut (most often a missing/invalid ASSEMBLYAI_API_KEY).
        const detail = err.message?.includes('Authentication')
          ? 'Subtitles skipped: ASSEMBLYAI_API_KEY is missing or invalid. Add a valid key from https://www.assemblyai.com/app and re-assemble.'
          : `Subtitles skipped: ${err.message}`;
        console.warn(`⚠️  ${detail}`);
        await pubsub.publish(projectId, {
          phase: 'subtitles',
          status: 'failed',
          error: detail,
        });
      }
    } else if (project.subtitlesKey) {
      console.log(`📝 [assembly] Reusing existing subtitles: ${project.subtitlesKey}`);
    } else if (!hasAnyVoice) {
      console.log('📝 [assembly] No voice on any scene — skipping subtitles.');
    }

    const style = project.styleId ? await styleRepo.findById(project.styleId) : null;
    const music = project.musicTrackId
      ? await musicTrackRepo.findById(project.musicTrackId)
      : null;

    const outputKey = r2Service.keys.finalVideo(projectId);

    const { tmpDir } = await assembler.assembleFinalVideo({
      projectId,
      sceneVideoKeys: scenes.map((s) => s.videoKey),
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
