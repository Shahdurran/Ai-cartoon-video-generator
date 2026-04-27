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
const cartoonAssembler = require('../../../services/cartoonAssemblerService');
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
  console.log(
    `📝 [subtitles] start project=${projectId} scenes=${scenes.length} format=${JSON.stringify(formatOptions)}`
  );

  try {
    const perSceneSrts = [];
    const perSceneDurations = [];
    let totalWords = 0;
    let totalCues = 0;

    for (const scene of scenes) {
      const idx = scene.sceneIndex;
      if (!scene.voiceKey) {
        console.log(`📝 [subtitles] scene ${idx}: no voiceKey, skipping (reserve ${scene.durationSeconds}s)`);
        perSceneSrts.push('');
        perSceneDurations.push(Number(scene.durationSeconds) || 5);
        continue;
      }

      const audioUrl = r2Service.isConfigured()
        ? await r2Service.getSignedDownloadUrl(scene.voiceKey, 3600)
        : scene.voiceKey;

      console.log(`📝 [subtitles] scene ${idx}: transcribing voiceKey=${scene.voiceKey}`);
      const { words, audioDurationSeconds } = await cartoonAssembly.transcribeWords(audioUrl);

      // AssemblyAI returns audio_duration rounded to whole seconds, which
      // adds up to noticeable subtitle drift over a 5-scene project (the
      // baked clips use the *true* MP3 duration, not the rounded one).
      // Probe the audio for its real float-second length and use that as
      // the per-scene timeline offset so the SRT stays in sync.
      let preciseDuration = await cartoonAssembler
        .probeDurationSeconds(audioUrl)
        .catch(() => null);
      // Fallback chain: ffprobe → last-word end → AssemblyAI rounded
      // duration → scripted scene duration.
      if (!preciseDuration && words.length > 0) {
        preciseDuration = (words[words.length - 1].end || 0) / 1000;
      }
      const sceneDurationSec =
        preciseDuration ||
        audioDurationSeconds ||
        Number(scene.durationSeconds) ||
        5;

      const sceneSrt = srt.formatSRT(words, formatOptions);
      const cueCount = (sceneSrt.match(/-->/g) || []).length;
      console.log(
        `📝 [subtitles] scene ${idx}: words=${words.length} cues=${cueCount} aaiDur=${audioDurationSeconds}s preciseDur=${preciseDuration ? preciseDuration.toFixed(3) : 'n/a'}s using=${sceneDurationSec.toFixed(3)}s`
      );
      totalWords += words.length;
      totalCues += cueCount;
      perSceneSrts.push(sceneSrt);
      perSceneDurations.push(sceneDurationSec);
    }

    const combined = srt.concatSRT(perSceneSrts, perSceneDurations);
    const key = r2Service.keys.subtitles(projectId);

    console.log(
      `📝 [subtitles] combined SRT bytes=${Buffer.byteLength(combined, 'utf8')} totalWords=${totalWords} totalCues=${totalCues}`
    );

    if (combined.trim().length === 0) {
      console.warn(
        `⚠️  [subtitles] combined SRT is empty for project ${projectId} -- skipping upload (no captions to burn).`
      );
      await pubsub.publish(projectId, {
        phase: 'subtitles',
        status: 'failed',
        error: 'Transcription returned no words for any scene voiceover.',
      });
      return { subtitlesKey: null, cues: 0 };
    }

    if (r2Service.isConfigured()) {
      await r2Service.upload(key, Buffer.from(combined, 'utf8'), 'application/x-subrip');
      console.log(`📝 [subtitles] uploaded to R2 key=${key}`);
    } else {
      console.warn('⚠️  [subtitles] R2 not configured; subtitles stored only in DB key reference.');
    }

    await projectRepo.update(projectId, { subtitlesKey: key });
    await pubsub.publish(projectId, { phase: 'subtitles', status: 'complete' });

    return { subtitlesKey: key, cues: totalCues };
  } catch (err) {
    console.error(`❌ [subtitles] project ${projectId} failed:`, err);
    await pubsub.publish(projectId, { phase: 'subtitles', status: 'failed', error: err.message });
    throw err;
  }
};
