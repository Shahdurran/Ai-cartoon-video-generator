/**
 * Hook generator processor.
 *
 * Given a completed project, produces N alternative openings spliced onto
 * the front of the existing final video.
 *
 * Pipeline per variant:
 *   1. Claude rewrites scene[0] voiceover into a hook script.
 *   2. ElevenLabs TTS -> hook audio (R2).
 *   3. AssemblyAI word timestamps -> SRT (R2).
 *   4. Seedance (submit+poll) -> hook clip using scene[0].selectedImage.
 *   5. Burn hook SRT on hook clip; concat with tail of original video.
 *   6. Upload to R2 under projects/{id}/hooks/{variantId}.mp4.
 *
 * Claude is invoked ONCE for all variants; step 2+ are parallelised per
 * variant.
 *
 * Job data: { projectId, hookDurationSeconds = 10, variantCount = 3 }
 */

const path = require('path');
const os = require('os');
const fs = require('fs-extra');

const ClaudeService = require('../../../services/claudeService');
const elevenLabs = require('../../../services/elevenLabsService');
const cartoonAssembly = require('../../../services/cartoonAssemblyService');
const srt = require('../../../services/srtService');
const falVideo = require('../../../services/falVideoService');
const assembler = require('../../../services/cartoonAssemblerService');

const r2Service = require('../../../services/r2Service');
const projectRepo = require('../../../db/repositories/projectRepo');
const sceneRepo = require('../../../db/repositories/sceneRepo');
const sceneImageRepo = require('../../../db/repositories/sceneImageRepo');
const hookVariantRepo = require('../../../db/repositories/hookVariantRepo');
const pubsub = require('../../../services/pubsubService');

const claude = new ClaudeService();

const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 120;

async function waitForSeedance({ requestId, modelId }) {
  for (let i = 0; i < MAX_POLLS; i++) {
    const status = await falVideo.getStatus({ requestId, modelId });
    const phase = status?.status || status;
    if (phase === 'COMPLETED') {
      return falVideo.getResult({ requestId, modelId });
    }
    if (phase !== 'IN_QUEUE' && phase !== 'IN_PROGRESS') {
      throw new Error(`Seedance terminal state for hook: ${phase}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Seedance poll timeout (hook)');
}

async function runVariant({ variantId, variantIndex, hookScript, projectId, scene0, style, project, hookDurationSeconds, tmpDir, originalVideoPath }) {
  await fs.ensureDir(tmpDir);
  await pubsub.publish(projectId, { phase: 'hook', status: 'running', variantIndex });

  // 1. Voiceover
  const audioBuffer = await elevenLabs.generateAudio(
    project.voiceId,
    hookScript,
    project.voiceSettings || {}
  );
  const voiceKey = `projects/${projectId}/hooks/${variantId}.mp3`;
  if (r2Service.isConfigured()) {
    await r2Service.upload(voiceKey, audioBuffer, 'audio/mpeg');
  }
  const localVoice = path.join(tmpDir, `hook-${variantIndex}.mp3`);
  await fs.writeFile(localVoice, audioBuffer);

  // 2. SRT for hook audio
  const audioUrl = r2Service.isConfigured()
    ? await r2Service.getSignedDownloadUrl(voiceKey, 3600)
    : localVoice;
  const { words, audioDurationSeconds } = await cartoonAssembly.transcribeWords(audioUrl);
  const hookSrt = srt.formatSRT(words, {
    maxCharsPerLine: project.subtitleSettings?.maxCharsPerLine || 32,
    maxLines: project.subtitleSettings?.maxLines || 2,
  });
  const hookSrtPath = path.join(tmpDir, `hook-${variantIndex}.srt`);
  await fs.writeFile(hookSrtPath, hookSrt, 'utf8');

  // 3. Seedance clip using scene0 image
  const image = scene0.selectedImageId
    ? await sceneImageRepo.findById(scene0.selectedImageId)
    : null;
  if (!image) throw new Error('Scene 0 has no selected image; cannot generate hook clip');

  const imageUrl = r2Service.isConfigured()
    ? await r2Service.getSignedDownloadUrl(image.r2Key, 3600)
    : image.r2Key;

  const { requestId, modelId } = await falVideo.submit({
    imageUrl,
    prompt: `${scene0.imagePrompt} -- emphasize opening beat, dynamic camera motion`,
    projectVideoSettings: project.videoModelSettings || {},
    hookDurationSeconds,
  });
  const { videoUrl } = await waitForSeedance({ requestId, modelId });

  const rawHookPath = path.join(tmpDir, `hook-${variantIndex}-raw.mp4`);
  await falVideo.downloadVideo(videoUrl, rawHookPath);

  // 4. Burn subtitle onto hook clip
  const hookWithSubsPath = path.join(tmpDir, `hook-${variantIndex}-subs.mp4`);
  const subtitleFontsDir = await assembler.prepareSubtitleFontDir(
    project.subtitleSettings || {},
    tmpDir
  );
  await new Promise((resolve, reject) => {
    const ffmpeg = require('fluent-ffmpeg');
    const subFilter = assembler.buildSubtitleFilter(
      hookSrtPath,
      project.subtitleSettings || {},
      { fontsDir: subtitleFontsDir }
    );
    const colorGrade = style?.ffmpegColorGrade;
    const videoFilter = colorGrade ? `${colorGrade},${subFilter}` : subFilter;

    ffmpeg(rawHookPath)
      .input(localVoice)
      .complexFilter([
        `[0:v]${videoFilter}[v]`,
        `[1:a]apad[a]`,
      ])
      .outputOptions([
        '-map', '[v]',
        '-map', '[a]',
        '-shortest',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-c:a', 'aac',
      ])
      .output(hookWithSubsPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  // 5. Trim original video tail starting after hookDurationSeconds
  const tailPath = path.join(tmpDir, `tail-${variantIndex}.mp4`);
  await assembler.trimLeading(originalVideoPath, hookDurationSeconds, tailPath);

  // 6. Concat hook + tail
  const variantOutputPath = path.join(tmpDir, `variant-${variantIndex}.mp4`);
  await assembler.spliceHook(hookWithSubsPath, tailPath, variantOutputPath);

  // 7. Upload to R2
  const outputKey = r2Service.keys.hookVideo(projectId, variantId);
  if (r2Service.isConfigured()) {
    await r2Service.uploadFromPath(outputKey, variantOutputPath, 'video/mp4');
  }

  await hookVariantRepo.update(variantId, { outputKey, status: 'complete' });
  await pubsub.publish(projectId, { phase: 'hook', status: 'complete', variantIndex, outputKey });

  return { variantId, outputKey };
}

module.exports = async function hookProcessor(job) {
  const { projectId, hookDurationSeconds = 10, variantCount = 3 } = job.data;
  if (!projectId) throw new Error('projectId required');

  const project = await projectRepo.findById(projectId);
  if (!project) throw new Error('Project not found');
  if (!project.outputKey) throw new Error('Project final video has not been assembled yet');

  const scenes = await sceneRepo.findByProject(projectId);
  if (scenes.length === 0) throw new Error('Project has no scenes');
  const scene0 = scenes[0];

  // 1. Claude produces all hook scripts in one call.
  const { hooks } = await claude.generateHookVariants({
    originalOpening: scene0.voiceoverText,
    topic: project.topic,
    variantCount,
    hookDurationSeconds,
  });

  // 2. Pre-create DB rows and grab their ids.
  const rows = [];
  for (let i = 0; i < hooks.length; i++) {
    const row = await hookVariantRepo.create({
      projectId,
      variantIndex: i,
      hookScript: hooks[i].script,
      hookDurationSeconds,
    });
    rows.push(row);
  }

  // 3. Download original final video once; all variants reuse it.
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `hook-${projectId}-`));
  const originalVideoPath = path.join(tmpDir, 'original.mp4');
  if (r2Service.isConfigured()) {
    await r2Service.downloadToFile(project.outputKey, originalVideoPath);
  } else {
    await fs.copy(project.outputKey, originalVideoPath);
  }

  const style = project.styleId
    ? await require('../../../db/repositories/styleRepo').findById(project.styleId)
    : null;

  try {
    // Parallelise variants -- each variant does its own Claude-less I/O path.
    const results = await Promise.allSettled(
      rows.map((row, i) =>
        runVariant({
          variantId: row.id,
          variantIndex: i,
          hookScript: hooks[i].script,
          projectId,
          scene0,
          style,
          project,
          hookDurationSeconds,
          tmpDir: path.join(tmpDir, `v${i}`),
          originalVideoPath,
        }).catch(async (err) => {
          await hookVariantRepo.update(row.id, { status: 'failed', errorMessage: err.message });
          await pubsub.publish(projectId, { phase: 'hook', status: 'failed', variantIndex: i, error: err.message });
          throw err;
        })
      )
    );

    const summary = results.map((r, i) => ({
      variantIndex: i,
      status: r.status,
      ...(r.status === 'fulfilled' ? r.value : { error: r.reason?.message }),
    }));

    return { variantCount: rows.length, results: summary };
  } finally {
    await fs.remove(tmpDir).catch(() => {});
  }
};
