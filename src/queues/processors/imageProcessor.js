const ImageService = require('../../services/imageService');
const StorageService = require('../../services/storageService');
const path = require('path');

/**
 * Image generation processor
 * @param {object} job - Bull job object
 */
async function processImageGeneration(job) {
  const { prompt, options = {}, projectId, outputDir } = job.data;

  try {
    await job.progress(10);

    const imageService = new ImageService();
    const storageService = new StorageService();

    await job.progress(20);

    // Generate image
    console.log(`🎨 Generating image for job ${job.id}...`);
    
    const outputPath = outputDir 
      ? path.join(outputDir, `image_${job.id}.jpg`)
      : null;

    const result = await imageService.generateImage(prompt, {
      ...options,
      outputPath,
    });

    await job.progress(80);

    // Save to project if projectId provided
    if (projectId) {
      const project = await storageService.getProject(projectId);
      if (!project.images) {
        project.images = [];
      }
      project.images.push({
        imagePath: result.imagePath,
        metadata: result.metadata,
      });
      await storageService.saveProject(project);
    }

    await job.progress(100);

    return {
      success: true,
      imagePath: result.imagePath,
      imageUrl: result.imageUrl,
      metadata: result.metadata,
      projectId,
      jobId: job.id,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`❌ Image generation failed for job ${job.id}:`, error.message);
    throw error;
  }
}

/**
 * Multiple images generation processor (Batch)
 * @param {object} job - Bull job object
 */
async function processMultipleImageGeneration(job) {
  const { prompts, settings = {}, projectId } = job.data;

  try {
    await job.progress(10);
    console.log(`🎨 Starting batch image generation for job ${job.id}...`);
    console.log(`   Generating ${prompts.length} images`);

    const imageService = new ImageService();
    const storageService = new StorageService();

    await job.progress(20);

    // Generate multiple images using Fal.AI batch
    const results = await imageService.generateImages(prompts, {
      aspectRatio: settings.aspectRatio || '16:9',
      quality: settings.quality || 'standard',
      model: settings.model || 'fal-ai/flux/dev',
      ...settings,
    });

    // Update progress incrementally
    const progressPerImage = 60 / prompts.length;
    for (let i = 0; i < results.length; i++) {
      await job.progress(20 + (i + 1) * progressPerImage);
    }

    await job.progress(85);

    const successCount = results.filter(r => r.success).length;
    console.log(`   ✅ Generated ${successCount}/${prompts.length} images successfully`);

    // Save to project if projectId provided
    if (projectId) {
      console.log(`   💾 Saving to project ${projectId}...`);
      const project = await storageService.getProject(projectId);
      project.images = results.filter(r => r.success).map(r => ({
        imagePath: r.imagePath,
        prompt: r.prompt,
        metadata: r.metadata,
      }));
      project.imageSettings = settings;
      project.updatedAt = new Date().toISOString();
      await storageService.saveProject(project);
    }

    await job.progress(100);

    return {
      success: successCount > 0,
      results,
      successCount,
      totalCount: prompts.length,
      projectId,
      jobId: job.id,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`❌ Multiple image generation failed for job ${job.id}:`, error.message);
    throw error;
  }
}

module.exports = {
  processImageGeneration,
  processMultipleImageGeneration,
};

