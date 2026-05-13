/**
 * Wire up the cartoon generator queue processors.
 *
 * Called once at process startup from server-new.js (after dotenv).
 * Optional: drain Redis queues first when CLEAR_BULL_QUEUES_ON_START=true
 * (recommended for Docker / fresh deploys so stale jobs are not replayed).
 */

const { queues } = require('./cartoonQueues');
const { drainCartoonQueues } = require('./drainCartoonQueues');

async function setupCartoonProcessors() {
  if (process.env.CLEAR_BULL_QUEUES_ON_START === 'true') {
    await drainCartoonQueues();
  }

  const sceneScriptProcessor = require('./processors/cartoon/sceneScriptProcessor');
  const sceneImagesProcessor = require('./processors/cartoon/sceneImagesProcessor');
  const sceneVoiceProcessor = require('./processors/cartoon/sceneVoiceProcessor');
  const projectSubtitlesProcessor = require('./processors/cartoon/projectSubtitlesProcessor');
  const seedanceProcessor = require('./processors/cartoon/seedanceProcessor');
  const finalAssemblyProcessor = require('./processors/cartoon/finalAssemblyProcessor');
  const hookProcessor = require('./processors/cartoon/hookProcessor');
  const shotImagesProcessor = require('./processors/cartoon/shotImagesProcessor');
  const shotVideoProcessor = require('./processors/cartoon/shotVideoProcessor');

  queues.sceneScript.process('generate', 2, sceneScriptProcessor);
  queues.sceneImages.process('generate-variants', 2, sceneImagesProcessor);
  queues.sceneVoice.process('generate', 3, sceneVoiceProcessor);
  queues.projectSubtitles.process('generate', 1, projectSubtitlesProcessor);

  // The Seedance queue handles two job names; Bull routes by name.
  queues.seedanceVideo.process('submit', 4, seedanceProcessor);
  queues.seedanceVideo.process('poll', 8, seedanceProcessor);

  // Per-shot variants. Same concurrency profile as scene-level images;
  // running multiple shots of the same project in parallel is the whole
  // point so users don't wait 5x longer for multi-shot scenes.
  queues.shotImages.process('generate-variants', 3, shotImagesProcessor);
  queues.shotVideo.process('submit', 4, shotVideoProcessor);
  queues.shotVideo.process('poll', 8, shotVideoProcessor);

  queues.finalAssembly.process('assemble', 1, finalAssemblyProcessor);
  queues.hookGenerator.process('generate', 1, hookProcessor);

  console.log('✅ Cartoon queue processors registered');
}

module.exports = { setupCartoonProcessors };
