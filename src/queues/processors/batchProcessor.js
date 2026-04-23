const { queues } = require('../index');
const StorageService = require('../../services/storageService');
const { JOB_PRIORITIES } = require('../../config/queue.config');

/**
 * Batch processing processor
 * @param {object} job - Bull job object
 */
async function processBatch(job) {
  const { batchId, videos } = job.data;

  try {
    await job.progress(5);

    const storageService = new StorageService();

    // Get batch configuration
    const batch = await storageService.getBatch(batchId);

    await job.progress(10);

    console.log(`📦 Processing batch ${batchId} with ${videos.length} videos...`);

    const results = [];
    const progressPerVideo = 80 / videos.length;

    // Process each video in the batch
    for (let i = 0; i < videos.length; i++) {
      const videoConfig = videos[i];
      
      try {
        console.log(`Processing video ${i + 1}/${videos.length} in batch ${batchId}...`);

        // Create a complete video generation workflow
        const workflowResult = await processVideoWorkflow(videoConfig, batchId);

        results.push({
          index: i,
          videoId: videoConfig.id,
          success: true,
          result: workflowResult,
        });

        // Update batch status
        await storageService.updateBatchStatus(batchId, {
          processedCount: i + 1,
          status: 'processing',
          results,
        });

      } catch (error) {
        console.error(`❌ Failed to process video ${i + 1} in batch:`, error.message);
        
        results.push({
          index: i,
          videoId: videoConfig.id,
          success: false,
          error: error.message,
        });
      }

      await job.progress(10 + (i + 1) * progressPerVideo);
    }

    await job.progress(95);

    // Update final batch status
    const successCount = results.filter(r => r.success).length;
    await storageService.updateBatchStatus(batchId, {
      status: 'completed',
      processedCount: videos.length,
      successCount,
      failedCount: videos.length - successCount,
      results,
      completedAt: new Date().toISOString(),
    });

    await job.progress(100);

    // Clean up completed pipeline jobs to prevent reprocessing
    console.log(`\n🧹 Cleaning up completed pipeline jobs...`);
    try {
      const { cleanQueue } = require('../index');
      await cleanQueue('pipeline', 0); // Remove completed jobs immediately
      console.log(`   ✅ Pipeline queue cleaned`);
    } catch (cleanError) {
      console.warn(`   ⚠️  Could not clean pipeline queue:`, cleanError.message);
    }

    return {
      success: true,
      batchId,
      totalVideos: videos.length,
      successCount,
      failedCount: videos.length - successCount,
      results,
      completedAt: new Date().toISOString(),
    };

  } catch (error) {
    console.error(`❌ Batch processing failed for job ${job.id}:`, error.message);
    
    // Update batch status to failed
    const storageService = new StorageService();
    await storageService.updateBatchStatus(batchId, {
      status: 'failed',
      error: error.message,
      failedAt: new Date().toISOString(),
    });

    throw error;
  }
}

/**
 * Process a complete video workflow (script -> images -> voice -> video)
 * @param {object} videoConfig - Video configuration
 * @param {string} batchId - Batch ID
 * @returns {Promise<object>} Workflow result
 */
async function processVideoWorkflow(videoConfig, batchId) {
  const storageService = new StorageService();
  
  // Load channel configuration if channelId is provided
  let channelConfig = {};
  let referenceScripts = videoConfig.referenceScripts || [];
  
  if (videoConfig.channelId) {
    try {
      const channel = await storageService.getChannel(videoConfig.channelId);
      channelConfig = channel;
      
      // Log voice settings from channel
      if (channel.voiceSettings) {
        console.log(`   🎙️  Channel voice settings:`, {
          voice: channel.voiceSettings.voice || 'not set',
          voiceCloneId: channel.voiceSettings.voiceCloneId || 'not set',
          speed: channel.voiceSettings.speed || 'not set',
          provider: channel.voiceSettings.provider || 'not set',
        });
      } else {
        console.log(`   ⚠️  Channel "${channel.name}" has no voiceSettings configured`);
      }
      
      // Get reference scripts from channel if not provided in video config
      if (!videoConfig.referenceScripts && channel.scriptSettings?.referenceScripts) {
        referenceScripts = channel.scriptSettings.referenceScripts.map(script => script.content);
        console.log(`📚 Using ${referenceScripts.length} reference scripts from channel ${channel.name}`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not load channel ${videoConfig.channelId}:`, error.message);
    }
  } else {
    console.log(`   ⚠️  No channelId provided, using default voice settings`);
  }
  
  // Create project for this video
  const projectId = await storageService.saveProject({
    batchId,
    videoId: videoConfig.id,
    title: videoConfig.title || 'Untitled Video', // FIXED: Include title
    context: videoConfig.context || '', // FIXED: Include context
    config: videoConfig,
    channelId: videoConfig.channelId,
    referenceScripts,
    status: 'processing',
  });

  const workflowSteps = [];

  try {
    // Use pipeline processor for complete workflow
    console.log(`🎬 Starting pipeline workflow for video ${videoConfig.id}...`);
    
    // Apply personVideoOverlay override if provided
    let finalChannelConfig = { ...channelConfig };
    if (videoConfig.personVideoOverlay) {
      console.log(`   🎭 Applying person video overlay override for this generation`);
      finalChannelConfig = {
        ...finalChannelConfig,
        visualSettings: {
          ...finalChannelConfig.visualSettings,
          type1: {
            ...finalChannelConfig.visualSettings?.type1,
            personVideoOverlay: videoConfig.personVideoOverlay,
          },
        },
      };
    } else if (channelConfig.visualSettings?.type1?.usePersonVideoPool && 
               channelConfig.visualSettings?.type1?.personVideoPool?.length > 0) {
      // Randomly select a person overlay from the pool
      const pool = channelConfig.visualSettings.type1.personVideoPool;
      const randomIndex = Math.floor(Math.random() * pool.length);
      const selectedOverlay = pool[randomIndex];
      
      console.log(`   🎲 Randomly selected person overlay #${randomIndex + 1} from pool of ${pool.length}: ${selectedOverlay.filename}`);
      console.log(`   📦 Selected overlay raw data:`, JSON.stringify(selectedOverlay, null, 2));
      
      // Ensure the person overlay has a path property
      const path = require('path');
      const overlayWithPath = {
        ...selectedOverlay,
        path: selectedOverlay.path || path.join(process.cwd(), 'person-videos', selectedOverlay.filename),
      };
      
      console.log(`   📁 Person overlay constructed path: ${overlayWithPath.path}`);
      console.log(`   ✅ Final overlay object:`, JSON.stringify({
        filename: overlayWithPath.filename,
        path: overlayWithPath.path,
        position: overlayWithPath.position,
        scale: overlayWithPath.scale,
        opacity: overlayWithPath.opacity,
        chromaKey: overlayWithPath.chromaKey
      }, null, 2));
      
      finalChannelConfig = {
        ...finalChannelConfig,
        visualSettings: {
          ...finalChannelConfig.visualSettings,
          type1: {
            ...finalChannelConfig.visualSettings?.type1,
            personVideoOverlay: overlayWithPath,
          },
        },
      };
    }

    // Apply backgroundMusic override if provided (old format - single track)
    if (videoConfig.backgroundMusic) {
      console.log(`   🎵 Applying background music override for this generation (single track)`);
      finalChannelConfig = {
        ...finalChannelConfig,
        audio: {
          ...finalChannelConfig.audio,
          backgroundMusic: videoConfig.backgroundMusic,
        },
      };
    }
    
    // Apply musicTracks override if provided (new format - multiple tracks)
    if (videoConfig.musicTracks && videoConfig.musicTracks.length > 0) {
      console.log(`   🎵 Applying ${videoConfig.musicTracks.length} music tracks override for this generation`);
      finalChannelConfig = {
        ...finalChannelConfig,
        audio: {
          ...finalChannelConfig.audio,
          musicTracks: videoConfig.musicTracks,
        },
      };
    }
    
    // Prepare voice settings with proper defaults (following stepByStepController pattern)
    const channelVoiceSettings = finalChannelConfig.voiceSettings || {};
    
    // Log the channel voice settings to debug
    console.log(`   📋 Raw channel voice settings:`, JSON.stringify(channelVoiceSettings, null, 2));
    
    // Extract language for both script and voice generation
    const configuredLanguage = channelVoiceSettings.language || 'English'; // Default to English if not specified
    console.log(`   🌍 Configured language for batch video: ${configuredLanguage}`);
    
    const finalVoiceSettings = {
      provider: channelVoiceSettings.provider || 'genaipro',
      voice: channelVoiceSettings.voice || null,
      voiceCloneId: channelVoiceSettings.voiceCloneId || null,
      speed: channelVoiceSettings.speed || 1.0,
      language: configuredLanguage,
    };
    
    // IMPORTANT: Validate that we have either a voice or voiceCloneId
    if (!finalVoiceSettings.voice && !finalVoiceSettings.voiceCloneId) {
      console.warn(`   ⚠️  WARNING: No voice or voiceCloneId configured for channel ${videoConfig.channelId}`);
      console.warn(`   ⚠️  This may cause voice generation to fail!`);
      console.warn(`   💡 Channel voice settings:`, JSON.stringify(channelVoiceSettings, null, 2));
    } else {
      console.log(`   ✅ Voice settings validated:`, {
        hasVoice: !!finalVoiceSettings.voice,
        hasVoiceCloneId: !!finalVoiceSettings.voiceCloneId,
        voice: finalVoiceSettings.voice,
        voiceCloneId: finalVoiceSettings.voiceCloneId,
      });
    }
    
    console.log(`   🎤 Final voice settings for pipeline:`, JSON.stringify(finalVoiceSettings, null, 2));
    
    const pipelineJob = await queues.pipeline.add({
      title: videoConfig.title,
      context: videoConfig.context || '',
      customPrompt: videoConfig.customPrompt,
      referenceScripts: referenceScripts,
      tone: finalChannelConfig.tone || 'informative',
      length: finalChannelConfig.length || 'medium',
      targetDuration: videoConfig.targetDuration || null, // Support dynamic duration
      targetWordCount: videoConfig.targetWordCount || null,
      numberOfImages: finalChannelConfig.numberOfImages || 5,
      imageSettings: finalChannelConfig.visualSettings || {},
      voiceSettings: finalVoiceSettings,
      videoSettings: finalChannelConfig.effects || {},
      channelId: videoConfig.channelId,
      channelConfig: finalChannelConfig,
      projectId,
    }, {
      priority: JOB_PRIORITIES.HIGH,
      attempts: 1, // Don't retry entire pipeline - individual steps handle retries
      timeout: 3600000, // 1 hour max for entire pipeline
      removeOnComplete: true, // Remove job immediately after completion to prevent reprocessing
      removeOnFail: false, // Keep failed jobs for debugging
    });

    // Wait for pipeline with timeout to prevent endless waiting
    const pipelineResult = await Promise.race([
      pipelineJob.finished(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Pipeline timeout after 1 hour')), 3600000)
      )
    ]);
    workflowSteps.push({ step: 'pipeline', success: true, result: pipelineResult });

    // Update project with final result
    await storageService.saveProject({
      id: projectId,
      status: 'completed',
      workflowSteps,
      videoPath: pipelineResult.videoPath,
      completedAt: new Date().toISOString(),
    });

    return {
      success: true,
      projectId,
      workflowSteps,
      videoPath: pipelineResult.videoPath,
    };

    /* Old workflow - keeping as reference
    // Step 1: Generate script (if needed)
    if (videoConfig.generateScript && videoConfig.scriptPrompt) {
      console.log('Step 1: Generating script...');
      const scriptJob = await queues.scriptGeneration.add({
        prompt: videoConfig.scriptPrompt,
        options: videoConfig.scriptOptions || {},
        referenceScripts,
        projectId,
      }, {
        priority: JOB_PRIORITIES.HIGH,
      });

      const scriptResult = await scriptJob.finished();
      workflowSteps.push({ step: 'script', success: true, result: scriptResult });
    }
    */

    // Step 2: Generate voice
    if (videoConfig.text || videoConfig.script) {
      console.log('Step 2: Generating voice...');
      const voiceJob = await queues.voiceGeneration.add({
        text: videoConfig.text || videoConfig.script,
        options: videoConfig.voiceOptions || {},
        projectId,
      }, {
        priority: JOB_PRIORITIES.HIGH,
      });

      const voiceResult = await voiceJob.finished();
      workflowSteps.push({ step: 'voice', success: true, result: voiceResult });
    }

    // Step 3: Generate images
    if (videoConfig.imagePrompts && videoConfig.imagePrompts.length > 0) {
      console.log('Step 3: Generating images...');
      const imageJob = await queues.imageGeneration.add({
        prompts: videoConfig.imagePrompts,
        projectId,
      }, {
        priority: JOB_PRIORITIES.HIGH,
      });

      const imageResult = await imageJob.finished();
      workflowSteps.push({ step: 'images', success: true, result: imageResult });
    }

    // Step 4: Generate video
    console.log('Step 4: Generating video...');
    const project = await storageService.getProject(projectId);
    
    const videoJob = await queues.videoProcessing.add({
      imagePath: videoConfig.imagePath || project.images[0].imagePath,
      audioPath: project.audioPath,
      subtitlePath: videoConfig.subtitlePath,
      outputPath: videoConfig.outputPath,
      options: videoConfig.videoOptions || {},
      projectId,
    }, {
      priority: JOB_PRIORITIES.HIGH,
    });

    const videoResult = await videoJob.finished();
    workflowSteps.push({ step: 'video', success: true, result: videoResult });

    // Update project status
    await storageService.saveProject({
      ...project,
      status: 'completed',
      workflowSteps,
      completedAt: new Date().toISOString(),
    });

    return {
      success: true,
      projectId,
      workflowSteps,
      videoPath: videoResult.videoPath,
    };

  } catch (error) {
    // Update project status to failed
    await storageService.saveProject({
      id: projectId,
      status: 'failed',
      error: error.message,
      workflowSteps,
      failedAt: new Date().toISOString(),
    });

    throw error;
  }
}

module.exports = {
  processBatch,
  processVideoWorkflow,
};

