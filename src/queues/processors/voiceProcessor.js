const VoiceService = require('../../services/voiceService');
const MockVoiceService = require('../../services/mockVoiceService');
const StorageService = require('../../services/storageService');
const path = require('path');

/**
 * Voice generation processor
 * Uses MockVoiceService by default (can be changed to real TTS)
 * @param {object} job - Bull job object
 */
async function processVoiceGeneration(job) {
  const { text, options = {}, projectId, useMock = true } = job.data;

  try {
    await job.progress(10);
    console.log(`🎙️  Starting voice generation for job ${job.id}...`);
    console.log(`   Text length: ${text.length} characters`);
    console.log(`   Using: ${useMock ? 'Mock Voice Service (silent audio)' : 'Real TTS'}`);
    console.log(`   📋 Voice options received in processor:`, JSON.stringify(options, null, 2));
    
    // Validate options
    if (!options || typeof options !== 'object') {
      console.error(`   ❌ Invalid options object:`, options);
      throw new Error('Invalid voice options: must be an object');
    }
    
    // Log key voice settings
    console.log(`   🎤 Voice settings:`, {
      provider: options.provider || 'default',
      voice: options.voice || 'none',
      voiceCloneId: options.voiceCloneId || 'none',
      speed: options.speed || 'default',
      language: options.language || 'none',
    });

    // Use MockVoiceService for testing, or real VoiceService when TTS is fixed
    const voiceService = useMock ? new MockVoiceService() : new VoiceService();
    const storageService = new StorageService();

    await job.progress(20);

    // Generate voice
    console.log(`   📤 Calling voiceService.generateVoice with options:`, JSON.stringify(options, null, 2));
    const result = await voiceService.generateVoice(text, options);

    await job.progress(80);
    console.log(`   ✅ Voice generated: ${result.audioPath}`);
    console.log(`   Duration: ${result.duration || result.metadata.estimatedDuration}s`);

    // Save to project if projectId provided
    if (projectId) {
      console.log(`   💾 Saving to project ${projectId}...`);
      const project = await storageService.getProject(projectId);
      project.audioPath = result.audioPath;
      project.audioDuration = result.duration || result.metadata.estimatedDuration;
      project.audioMetadata = result.metadata;
      project.updatedAt = new Date().toISOString();
      await storageService.saveProject(project);
    }

    await job.progress(100);

    return {
      success: true,
      audioPath: result.audioPath,
      duration: result.duration || result.metadata.estimatedDuration,
      provider: result.provider,
      metadata: result.metadata,
      projectId,
      jobId: job.id,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`❌ Voice generation failed for job ${job.id}:`, error.message);
    throw error;
  }
}

module.exports = {
  processVoiceGeneration,
};

