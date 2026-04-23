const { AssemblyAI } = require('assemblyai');
const apiConfig = require('../../config/api.config');
const StorageService = require('../../services/storageService');
const fs = require('fs-extra');

/**
 * Transcription processor using AssemblyAI
 * @param {object} job - Bull job object
 */
async function processTranscription(job) {
  const { audioPath, options = {}, projectId } = job.data;

  try {
    await job.progress(10);

    if (!apiConfig.assemblyAI.apiKey) {
      throw new Error('ASSEMBLYAI_API_KEY not configured');
    }

    const client = new AssemblyAI({
      apiKey: apiConfig.assemblyAI.apiKey,
    });

    await job.progress(20);

    // Upload audio file
    console.log(`🎤 Uploading audio for transcription (job ${job.id})...`);
    const audioData = await fs.readFile(audioPath);
    const uploadUrl = await client.files.upload(audioData);

    await job.progress(40);

    // Start transcription
    console.log(`🎤 Starting transcription for job ${job.id}...`);
    const transcript = await client.transcripts.transcribe({
      audio_url: uploadUrl,
      language_code: options.languageCode || 'en',
      speaker_labels: options.speakerLabels || false,
      auto_highlights: options.autoHighlights || false,
      entity_detection: options.entityDetection || false,
      sentiment_analysis: options.sentimentAnalysis || false,
    });

    await job.progress(90);

    // Save transcription to project if projectId provided
    if (projectId) {
      const storageService = new StorageService();
      const project = await storageService.getProject(projectId);
      project.transcription = {
        text: transcript.text,
        words: transcript.words,
        utterances: transcript.utterances,
        metadata: {
          language: transcript.language_code,
          duration: transcript.audio_duration,
          transcribedAt: new Date().toISOString(),
        },
      };
      await storageService.saveProject(project);
    }

    await job.progress(100);

    return {
      success: true,
      text: transcript.text,
      words: transcript.words,
      utterances: transcript.utterances,
      duration: transcript.audio_duration,
      projectId,
      jobId: job.id,
      completedAt: new Date().toISOString(),
    };

  } catch (error) {
    console.error(`❌ Transcription failed for job ${job.id}:`, error.message);
    throw error;
  }
}

module.exports = {
  processTranscription,
};

