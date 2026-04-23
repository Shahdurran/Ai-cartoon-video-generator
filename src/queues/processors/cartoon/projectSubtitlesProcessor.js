/**
 * Project-level subtitle processor.
 *
 * Submits each scene's voice audio URL to AssemblyAI, formats the returned
 * word-level timestamps into SRT cues per scene, concatenates with
 * per-scene offsets into a single project-level SRT, uploads to R2, and
 * writes the key to projects.subtitles_key.
 *
 * Job data: { projectId }
 */

const sceneRepo = require('../../../db/repositories/sceneRepo');
const projectRepo = require('../../../db/repositories/projectRepo');
const r2Service = require('../../../services/r2Service');
const cartoonAssembly = require('../../../services/cartoonAssemblyService');
const srt = require('../../../services/srtService');
const pubsub = require('../../../services/pubsubService');

module.exports = async function projectSubtitlesProcessor(job) {
  const { projectId, subtitleSettings: override } = job.data;
  if (!projectId) throw new Error('projectId required');

  const project = await projectRepo.findById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  const scenes = await sceneRepo.findByProject(projectId);

  const formatOptions = {
    maxCharsPerLine: (override?.maxCharsPerLine) || (project.subtitleSettings?.maxCharsPerLine) || 32,
    maxLines: (override?.maxLines) || (project.subtitleSettings?.maxLines) || 2,
  };

  await pubsub.publish(projectId, { phase: 'subtitles', status: 'running' });

  try {
    const perSceneSrts = [];
    const perSceneDurations = [];

    for (const scene of scenes) {
      if (!scene.voiceKey) {
        // No audio for this scene -- reserve its duration so later scenes
        // still have correct offsets.
        perSceneSrts.push('');
        perSceneDurations.push(Number(scene.durationSeconds) || 5);
        continue;
      }

      const audioUrl = r2Service.isConfigured()
        ? await r2Service.getSignedDownloadUrl(scene.voiceKey, 3600)
        : scene.voiceKey;

      const { words, audioDurationSeconds } = await cartoonAssembly.transcribeWords(audioUrl);
      const sceneSrt = srt.formatSRT(words, formatOptions);
      perSceneSrts.push(sceneSrt);
      perSceneDurations.push(audioDurationSeconds || Number(scene.durationSeconds) || 5);
    }

    const combined = srt.concatSRT(perSceneSrts, perSceneDurations);
    const key = r2Service.keys.subtitles(projectId);

    if (r2Service.isConfigured()) {
      await r2Service.upload(key, Buffer.from(combined, 'utf8'), 'application/x-subrip');
    }

    await projectRepo.update(projectId, { subtitlesKey: key });
    await pubsub.publish(projectId, { phase: 'subtitles', status: 'complete' });

    return { subtitlesKey: key, cues: (combined.match(/-->/g) || []).length };
  } catch (err) {
    await pubsub.publish(projectId, { phase: 'subtitles', status: 'failed', error: err.message });
    throw err;
  }
};
