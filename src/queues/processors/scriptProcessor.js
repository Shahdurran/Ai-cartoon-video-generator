const ClaudeService = require('../../services/claudeService');
const StorageService = require('../../services/storageService');

/**
 * Script generation processor
 * @param {object} job - Bull job object
 */
async function processScriptGeneration(job) {
  const { 
    title, 
    context = '', 
    tone = 'informative', 
    length = 'medium', 
    referenceScripts = [], 
    customPrompt = '', 
    projectId,
    language = 'English', // Language from voice settings
    targetDuration = null,
    targetWordCount = null,
  } = job.data;

  try {
    // Update progress
    await job.progress(10);
    console.log(`📝 Starting script generation for job ${job.id}...`);
    console.log(`   Title: "${title}"`);
    console.log(`   🌍 Language: ${language}`);

    // Initialize services
    const claudeService = new ClaudeService();
    const storageService = new StorageService();

    await job.progress(20);

    // Generate script using Claude
    console.log(`   🤖 Calling Claude API...`);
    const result = await claudeService.generateScript({
      title,
      context,
      tone,
      length,
      referenceScripts,
      customPrompt,
      language, // Pass language to Claude service
      targetDuration,
      targetWordCount,
    });

    await job.progress(80);
    console.log(`   ✅ Script generated: ${result.sentences.length} sentences, ~${result.estimatedDuration}s`);

    // Save script to project if projectId provided
    if (projectId) {
      console.log(`   💾 Saving to project ${projectId}...`);
      const project = await storageService.getProject(projectId);
      project.script = result.script;
      project.sentences = result.sentences;
      project.estimatedDuration = result.estimatedDuration;
      project.scriptMetadata = result.metadata;
      project.updatedAt = new Date().toISOString();
      await storageService.saveProject(project);
    }

    await job.progress(100);

    return {
      success: true,
      script: result.script,
      sentences: result.sentences,
      estimatedDuration: result.estimatedDuration,
      metadata: result.metadata,
      projectId,
      jobId: job.id,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`❌ Script generation failed for job ${job.id}:`, error.message);
    throw error;
  }
}

/**
 * Image prompt generation processor
 * @param {object} job - Bull job object
 */
async function processImagePromptGeneration(job) {
  const { script, numberOfImages = 5, projectId } = job.data;

  try {
    await job.progress(10);

    const claudeService = new ClaudeService();
    const storageService = new StorageService();

    await job.progress(20);

    // Generate image prompts
    console.log(`🎨 Generating ${numberOfImages} image prompts for job ${job.id}...`);
    const result = await claudeService.generateImagePrompts(script, numberOfImages);

    await job.progress(80);

    // Save to project if projectId provided
    if (projectId) {
      const project = await storageService.getProject(projectId);
      project.imagePrompts = result.imagePrompts;
      await storageService.saveProject(project);
    }

    await job.progress(100);

    return {
      success: true,
      imagePrompts: result.imagePrompts,
      metadata: result.metadata,
      projectId,
      jobId: job.id,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`❌ Image prompt generation failed for job ${job.id}:`, error.message);
    throw error;
  }
}

module.exports = {
  processScriptGeneration,
  processImagePromptGeneration,
};

