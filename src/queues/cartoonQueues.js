/**
 * Cartoon generator queues.
 *
 * Separate from the legacy Bull queues so the old pipeline keeps running
 * untouched. Instantiated once at process start via setupCartoonProcessors().
 */

const Bull = require('bull');
const { queueConfig } = require('../config/queue.config');

const QUEUE_NAMES = {
  SCENE_SCRIPT: 'cartoon-scene-script',
  SCENE_IMAGES: 'cartoon-scene-images',
  SCENE_VOICE: 'cartoon-scene-voice',
  PROJECT_SUBTITLES: 'cartoon-project-subtitles',
  SEEDANCE_VIDEO: 'seedance-video-queue',
  FINAL_ASSEMBLY: 'final-assembly-queue',
  HOOK_GENERATOR: 'hook-generator-queue',
};

const queues = {
  sceneScript: new Bull(QUEUE_NAMES.SCENE_SCRIPT, queueConfig),
  sceneImages: new Bull(QUEUE_NAMES.SCENE_IMAGES, {
    ...queueConfig,
    defaultJobOptions: { ...queueConfig.defaultJobOptions, timeout: 10 * 60 * 1000 },
  }),
  sceneVoice: new Bull(QUEUE_NAMES.SCENE_VOICE, queueConfig),
  projectSubtitles: new Bull(QUEUE_NAMES.PROJECT_SUBTITLES, queueConfig),
  seedanceVideo: new Bull(QUEUE_NAMES.SEEDANCE_VIDEO, {
    ...queueConfig,
    defaultJobOptions: {
      ...queueConfig.defaultJobOptions,
      // Seedance jobs may poll for 20+ minutes; give plenty of timeout.
      timeout: 40 * 60 * 1000,
      attempts: 2,
    },
  }),
  finalAssembly: new Bull(QUEUE_NAMES.FINAL_ASSEMBLY, {
    ...queueConfig,
    defaultJobOptions: {
      ...queueConfig.defaultJobOptions,
      timeout: 30 * 60 * 1000,
      attempts: 1,
    },
  }),
  hookGenerator: new Bull(QUEUE_NAMES.HOOK_GENERATOR, {
    ...queueConfig,
    defaultJobOptions: {
      ...queueConfig.defaultJobOptions,
      timeout: 45 * 60 * 1000,
      attempts: 1,
    },
  }),
};

// Standard logging listeners for all cartoon queues.
for (const [name, queue] of Object.entries(queues)) {
  queue.on('error', (err) => console.error(`❌ ${name} error:`, err.message));
  queue.on('failed', (job, err) =>
    console.error(`❌ ${name} job ${job.id} failed:`, err.message)
  );
  queue.on('completed', (job) =>
    console.log(`✅ ${name} job ${job.id} completed`)
  );
}

async function closeAll() {
  for (const q of Object.values(queues)) {
    try { await q.close(); } catch (_) { /* ignore */ }
  }
}

module.exports = { queues, QUEUE_NAMES, closeAll };
