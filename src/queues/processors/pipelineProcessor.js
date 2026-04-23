const { v4: uuidv4 } = require('uuid');
const StorageService = require('../../services/storageService');
const { getQueue } = require('../index');
const { RETRY_STRATEGIES, JOB_TIMEOUTS } = require('../../config/queue.config');

/**
 * Wait for job to finish with timeout
 * @param {object} job - Bull job object
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} stepName - Name of the step (for error messages)
 * @returns {Promise<object>} Job result
 */
async function waitForJobWithTimeout(job, timeoutMs, stepName) {
  return Promise.race([
    job.finished(),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${stepName} step timed out after ${timeoutMs / 1000} seconds`));
      }, timeoutMs);
    })
  ]);
}

/**
 * Pipeline Processor - Orchestrates the entire video generation workflow
 * Steps: Script → Voice → Images → Video
 * @param {object} job - Bull job object
 */
async function processPipeline(job) {
  const { 
    title,
    context = '',
    customPrompt = '',
    referenceScripts = [],
    tone = 'informative',
    length = 'medium',
    targetDuration = null, // NEW: Target duration in seconds
    targetWordCount = null, // NEW: Target word count
    numberOfImages = 5,
    imageSettings = {},
    voiceSettings = {},
    videoSettings = {},
    channelId,
  } = job.data;

  const projectId = job.data.projectId || `project_${uuidv4()}`;
  const storageService = new StorageService();

  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎬 STARTING PIPELINE for job ${job.id}`);
    console.log(`   Project ID: ${projectId}`);
    console.log(`   Title: "${title}"`);
    console.log(`${'='.repeat(70)}\n`);

    // Initialize project (or load existing one if already created by batch processor)
    await job.progress(5);
    let project;
    
    try {
      // Try to load existing project first (in case batch processor already created it)
      project = await storageService.getProject(projectId);
      console.log(`   ℹ️  Loading existing project: ${projectId}`);
      // Update status to processing and add job info
      project.jobId = job.id;
      project.status = 'processing';
      project.updatedAt = new Date().toISOString();
      // Ensure steps exist
      if (!project.steps) {
        project.steps = {
          script: { status: 'pending', jobId: null },
          voice: { status: 'pending', jobId: null },
          images: { status: 'pending', jobId: null },
          video: { status: 'pending', jobId: null },
        };
      }
    } catch (error) {
      // Project doesn't exist yet, create it
      console.log(`   ℹ️  Creating new project: ${projectId}`);
      project = {
        id: projectId,
        jobId: job.id,
        title,
        context,
        status: 'processing',
        steps: {
          script: { status: 'pending', jobId: null },
          voice: { status: 'pending', jobId: null },
          images: { status: 'pending', jobId: null },
          video: { status: 'pending', jobId: null },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    await storageService.saveProject(project);

    // === STEP 1: Generate Script ===
    console.log(`📝 [1/4] Generating script...`);
    
    // Get language from voice settings to ensure script matches voice language
    const scriptLanguage = voiceSettings?.language || 'English';
    console.log(`   🌍 Script will be generated in: ${scriptLanguage}`);
    
    await job.progress(10);
    project.steps.script.status = 'processing';
    await storageService.saveProject(project);

    const scriptQueue = getQueue('scriptGeneration');
    const scriptRetry = RETRY_STRATEGIES.SCRIPT_GENERATION;
    const scriptJob = await scriptQueue.add({
      title,
      context,
      customPrompt,
      referenceScripts,
      tone,
      length,
      targetDuration, // NEW: Pass target duration to script generation
      targetWordCount, // NEW: Pass target word count to script generation
      language: scriptLanguage, // Pass language from voice settings
      projectId,
    }, {
      priority: 1,
      attempts: scriptRetry.attempts,
      backoff: scriptRetry.backoff,
      timeout: JOB_TIMEOUTS.SCRIPT_GENERATION,
      jobId: `script-${projectId}-${Date.now()}`, // Unique job ID with context
    });
    
    if (referenceScripts && referenceScripts.length > 0) {
      console.log(`   📚 Using ${referenceScripts.length} reference script(s) for style learning`);
    }

    project.steps.script.jobId = scriptJob.id;
    await storageService.saveProject(project);

    // Wait for script to complete with timeout
    const scriptResult = await waitForJobWithTimeout(
      scriptJob, 
      JOB_TIMEOUTS.SCRIPT_GENERATION * 2, // Allow 2x timeout for retries
      'Script generation'
    );
    project.steps.script.status = 'completed';
    project.script = scriptResult.script;
    project.sentences = scriptResult.sentences;
    await storageService.saveProject(project);
    
    await job.progress(30);
    console.log(`   ✅ Script completed: ${scriptResult.sentences.length} sentences`);

    // === STEP 2: Generate Voice ===
    console.log(`\n🎙️  [2/4] Generating voice narration...`);
    console.log(`   📋 Voice settings received in pipeline:`, JSON.stringify(voiceSettings, null, 2));
    
    // Validate voice settings
    if (!voiceSettings || typeof voiceSettings !== 'object') {
      console.error(`   ❌ Invalid voiceSettings object:`, voiceSettings);
      throw new Error('Invalid voiceSettings: must be an object');
    }
    
    if (voiceSettings.voiceCloneId) {
      console.log(`   🎭 Using voice clone ID: ${voiceSettings.voiceCloneId}`);
    } else if (voiceSettings.voice) {
      console.log(`   🎤 Using voice: ${voiceSettings.voice}`);
    } else {
      console.log(`   ⚠️  No voice or voiceCloneId specified, will use API default`);
    }
    
    // Log what will be passed to voice queue
    console.log(`   📤 Options to be passed to voice generation:`, JSON.stringify(voiceSettings, null, 2));
    await job.progress(35);
    project.steps.voice.status = 'processing';
    await storageService.saveProject(project);

    const voiceQueue = getQueue('voiceGeneration');
    const voiceRetry = RETRY_STRATEGIES.VOICE_GENERATION;
    const voiceJob = await voiceQueue.add({
      title, // Include title in data for display
      text: scriptResult.script,
      options: voiceSettings,
      projectId,
      useMock: false, // FIXED: Use real TTS for actual voice narration
    }, {
      priority: 1,
      attempts: voiceRetry.attempts, // 1 attempt - fail fast to prevent endless retries
      backoff: voiceRetry.backoff,
      timeout: JOB_TIMEOUTS.VOICE_GENERATION,
      jobId: `voice-${projectId}-${Date.now()}`, // Unique job ID with context
    });

    project.steps.voice.jobId = voiceJob.id;
    await storageService.saveProject(project);

    // Wait for voice to complete with timeout (no retries, so just use timeout)
    const voiceResult = await waitForJobWithTimeout(
      voiceJob,
      JOB_TIMEOUTS.VOICE_GENERATION,
      'Voice generation'
    );
    project.steps.voice.status = 'completed';
    project.audioPath = voiceResult.audioPath;
    project.audioDuration = voiceResult.duration;
    await storageService.saveProject(project);

    await job.progress(55);
    console.log(`   ✅ Voice completed: ${voiceResult.audioPath}`);

    // === STEP 3: Generate Images (TYPE_2 only) ===
    const channelType = job.data.channelConfig?.type || 'TYPE_2';
    
    if (channelType === 'TYPE_1') {
      // TYPE_1 uses background videos, skip image generation
      console.log(`\n📹 [3/4] TYPE_1 channel detected - Skipping image generation (uses background videos)`);
      await job.progress(60);
      project.steps.images.status = 'skipped';
      project.images = []; // Empty array for TYPE_1
      await storageService.saveProject(project);
      await job.progress(85);
      console.log(`   ✅ Images skipped for TYPE_1 channel`);
    } else {
      // TYPE_2: Generate AI images
      console.log(`\n🎨 [3/4] Generating ${numberOfImages} images...`);
      await job.progress(60);
      project.steps.images.status = 'processing';
      await storageService.saveProject(project);

      // NEW: Use image-script matcher to generate contextual prompts
      const { groupSentencesIntoBlocks, generateImagePromptsFromBlocks } = require('../../utils/imageScriptMatcher');
      
      // Group sentences into blocks for image generation
      const sentenceBlocks = groupSentencesIntoBlocks(scriptResult.sentences, numberOfImages);
      console.log(`   📊 Grouped ${scriptResult.sentences.length} sentences into ${sentenceBlocks.length} blocks`);
      
      // Generate image prompts from sentence blocks
      const imagePromptData = generateImagePromptsFromBlocks(sentenceBlocks, imageSettings.style || 'realistic, cinematic');
      const imagePrompts = imagePromptData.map(p => p.prompt);
      
      console.log(`   🎨 Generated ${imagePrompts.length} contextual image prompts from script`);

      const imageQueue = getQueue('imageGeneration');
      const imageRetry = RETRY_STRATEGIES.IMAGE_GENERATION;
      const imageJob = await imageQueue.add('batch', { // Keep 'batch' as job type for routing
        title, // Include title in data for display
        prompts: imagePrompts,
        settings: {
          aspectRatio: imageSettings.aspectRatio || '16:9',
          quality: imageSettings.quality || 'standard',
          ...imageSettings,
        },
        projectId,
      }, {
        priority: 1,
        attempts: imageRetry.attempts,
        backoff: imageRetry.backoff,
        timeout: JOB_TIMEOUTS.IMAGE_GENERATION,
        jobId: `images-${projectId}-${Date.now()}`, // Unique job ID with context
      });

      project.steps.images.jobId = imageJob.id;
      await storageService.saveProject(project);

      // Wait for images to complete with timeout
      const imageResult = await waitForJobWithTimeout(
        imageJob,
        JOB_TIMEOUTS.IMAGE_GENERATION * 2, // Allow 2x timeout for retries
        'Image generation'
      );
      project.steps.images.status = 'completed';
      
      // Match images to sentences with timing
      const { matchImagesToSentences } = require('../../utils/imageScriptMatcher');
      const successfulImages = imageResult.results.filter(r => r.success);
      
      const imageBlocks = matchImagesToSentences(
        scriptResult.sentences,
        successfulImages,
        voiceResult.duration
      );
      
      console.log(`   🔗 Matched ${imageBlocks.length} images to script sentences with timing`);
      
      // Attach image blocks to images for video processor
      project.images = successfulImages.map((img, i) => ({
        ...img,
        block: imageBlocks[i],
      }));
      
      await storageService.saveProject(project);

      await job.progress(85);
      console.log(`   ✅ Images completed: ${imageResult.successCount}/${imageResult.totalCount} generated`);
    }

    // === STEP 4: Generate Video ===
    console.log(`\n🎬 [4/4] Assembling final video...`);
    await job.progress(90);
    project.steps.video.status = 'processing';
    await storageService.saveProject(project);

    const videoQueue = getQueue('videoProcessing');
    const videoRetry = RETRY_STRATEGIES.VIDEO_PROCESSING;
    const videoJob = await videoQueue.add({
      title, // Include title in data for display
      projectId,
      audioPath: voiceResult.audioPath,
      images: project.images, // Now includes image blocks with timing
      script: scriptResult.script,
      sentences: scriptResult.sentences,
      settings: {
        ...videoSettings,
        fps: videoSettings.fps || 30,
        resolution: videoSettings.resolution || '1920x1080',
        codec: videoSettings.codec || 'libx264',
      },
      channelConfig: job.data.channelConfig || {}, // Pass channel config to video processor
      type: job.data.channelConfig?.type || 'TYPE_2',
    }, {
      priority: 1,
      attempts: videoRetry.attempts,
      backoff: videoRetry.backoff,
      timeout: JOB_TIMEOUTS.VIDEO_PROCESSING,
      jobId: `video-${projectId}-${Date.now()}`, // Unique job ID with context
    });

    project.steps.video.jobId = videoJob.id;
    await storageService.saveProject(project);

    // Wait for video to complete with timeout
    const videoResult = await waitForJobWithTimeout(
      videoJob,
      JOB_TIMEOUTS.VIDEO_PROCESSING * 2, // Allow 2x timeout for retries
      'Video processing'
    );
    project.steps.video.status = 'completed';
    project.videoPath = videoResult.videoPath;
    project.videoDuration = videoResult.duration;
    project.status = 'completed';
    project.completedAt = new Date().toISOString();
    await storageService.saveProject(project);

    await job.progress(100);
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ PIPELINE COMPLETED for job ${job.id}`);
    console.log(`   Video: ${videoResult.videoPath}`);
    console.log(`   Duration: ${videoResult.duration}s`);
    console.log(`${'='.repeat(70)}\n`);

    return {
      success: true,
      projectId,
      videoPath: videoResult.videoPath,
      duration: videoResult.duration,
      steps: {
        script: scriptResult,
        voice: voiceResult,
        images: channelType === 'TYPE_1' ? { skipped: true } : imageResult,
        video: videoResult,
      },
      completedAt: new Date().toISOString(),
    };

  } catch (error) {
    console.error(`\n❌ PIPELINE FAILED for job ${job.id}:`, error.message);
    
    // Update project status
    try {
      const project = await storageService.getProject(projectId);
      project.status = 'failed';
      project.error = error.message;
      project.failedAt = new Date().toISOString();
      await storageService.saveProject(project);
    } catch (saveError) {
      console.error(`Failed to update project status:`, saveError.message);
    }

    throw error;
  }
}

module.exports = {
  processPipeline,
};

