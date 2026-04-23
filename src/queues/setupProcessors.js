/**
 * Setup queue processors
 * This file registers all job processors for Bull queues
 */

const { queues } = require('./index');
const { processScriptGeneration, processImagePromptGeneration } = require('./processors/scriptProcessor');
const { processVoiceGeneration } = require('./processors/voiceProcessor');
const { processImageGeneration, processMultipleImageGeneration } = require('./processors/imageProcessor');
const { processVideoGeneration } = require('./processors/videoProcessor');
const { processBatch } = require('./processors/batchProcessor');
const { processTranscription } = require('./processors/transcriptionProcessor');
const { processPipeline } = require('./processors/pipelineProcessor');
const { QUEUE_CONCURRENCY } = require('../config/queue.config');

/**
 * Setup all queue processors
 */
function setupProcessors() {
  console.log('🔧 Setting up queue processors...');

  // Script Generation Queue
  queues.scriptGeneration.process(async (job) => {
    if (job.data.type === 'image-prompts') {
      return await processImagePromptGeneration(job);
    } else if (job.data.type === 'refine') {
      // Handle script refinement
      const ClaudeService = require('../services/claudeService');
      const claudeService = new ClaudeService();
      return await claudeService.refineScript(job.data.script, job.data.instructions);
    } else {
      return await processScriptGeneration(job);
    }
  });
  console.log('✅ Script generation processor registered');

  // Voice Generation Queue
  queues.voiceGeneration.process(async (job) => {
    return await processVoiceGeneration(job);
  });
  console.log('✅ Voice generation processor registered');

  // Image Generation Queue (with named processors for batch)
  queues.imageGeneration.process('batch', QUEUE_CONCURRENCY.IMAGE_GENERATION, async (job) => {
    return await processMultipleImageGeneration(job);
  });
  queues.imageGeneration.process('single', QUEUE_CONCURRENCY.IMAGE_GENERATION, async (job) => {
    return await processImageGeneration(job);
  });
  console.log('✅ Image generation processor registered');

  // Video Processing Queue
  queues.videoProcessing.process(async (job) => {
    return await processVideoGeneration(job);
  });
  console.log('✅ Video processing processor registered');

  // Batch Processing Queue
  queues.batchProcessing.process(async (job) => {
    return await processBatch(job);
  });
  console.log('✅ Batch processing processor registered');

  // Transcription Queue
  queues.transcription.process(async (job) => {
    return await processTranscription(job);
  });
  console.log('✅ Transcription processor registered');

  // Pipeline Queue (Master Orchestrator)
  queues.pipeline.process(1, async (job) => {
    return await processPipeline(job);
  });
  console.log('✅ Pipeline processor registered');

  console.log('🎉 All queue processors setup complete!');
}

module.exports = { setupProcessors };

