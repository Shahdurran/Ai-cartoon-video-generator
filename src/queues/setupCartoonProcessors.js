/**
 * Wire up the cartoon generator queue processors.
 *
 * Called once at app startup alongside the existing setupProcessors().
 * Separate from the legacy wiring so a partial install (no R2 / no ElevenLabs)
 * doesn't brick the legacy pipelines.
 */

const { queues } = require('./cartoonQueues');

function setupCartoonProcessors() {
  const sceneScriptProcessor = require('./processors/cartoon/sceneScriptProcessor');
  const sceneImagesProcessor = require('./processors/cartoon/sceneImagesProcessor');
  const sceneVoiceProcessor = require('./processors/cartoon/sceneVoiceProcessor');
  const projectSubtitlesProcessor = require('./processors/cartoon/projectSubtitlesProcessor');
  const seedanceProcessor = require('./processors/cartoon/seedanceProcessor');
  const finalAssemblyProcessor = require('./processors/cartoon/finalAssemblyProcessor');
  const hookProcessor = require('./processors/cartoon/hookProcessor');

  queues.sceneScript.process('generate', 2, sceneScriptProcessor);
  queues.sceneImages.process('generate-variants', 2, sceneImagesProcessor);
  queues.sceneVoice.process('generate', 3, sceneVoiceProcessor);
  queues.projectSubtitles.process('generate', 1, projectSubtitlesProcessor);

  // The Seedance queue handles two job names; Bull routes by name.
  queues.seedanceVideo.process('submit', 4, seedanceProcessor);
  queues.seedanceVideo.process('poll', 8, seedanceProcessor);

  queues.finalAssembly.process('assemble', 1, finalAssemblyProcessor);
  queues.hookGenerator.process('generate', 1, hookProcessor);

  console.log('✅ Cartoon queue processors registered');
}

module.exports = { setupCartoonProcessors };
