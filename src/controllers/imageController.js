const { queues } = require('../queues');
const { JOB_PRIORITIES } = require('../config/queue.config');

class ImageController {
  /**
   * Generate a single image
   */
  static async generateImage(req, res) {
    try {
      const { 
        prompt, 
        width = 1024,
        height = 576,
        numInferenceSteps = 28,
        guidanceScale = 3.5,
        seed,
        projectId, 
        outputDir,
        priority = 'normal' 
      } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // Add job to queue
      const job = await queues.imageGeneration.add(
        {
          prompt,
          options: {
            width,
            height,
            numInferenceSteps,
            guidanceScale,
            seed,
          },
          projectId,
          outputDir,
        },
        {
          priority: JOB_PRIORITIES[priority.toUpperCase()] || JOB_PRIORITIES.NORMAL,
        }
      );

      res.json({
        success: true,
        jobId: job.id,
        message: 'Image generation job queued',
        status: await job.getState(),
      });
    } catch (error) {
      console.error('Image generation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Generate multiple images
   */
  static async generateMultipleImages(req, res) {
    try {
      const { 
        prompts, 
        projectId, 
        outputDir,
        priority = 'normal' 
      } = req.body;

      if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
        return res.status(400).json({ error: 'Prompts array is required' });
      }

      // Add job to queue
      const job = await queues.imageGeneration.add(
        {
          type: 'multiple',
          prompts,
          projectId,
          outputDir,
        },
        {
          priority: JOB_PRIORITIES[priority.toUpperCase()] || JOB_PRIORITIES.NORMAL,
        }
      );

      res.json({
        success: true,
        jobId: job.id,
        message: `${prompts.length} image generation jobs queued`,
        status: await job.getState(),
      });
    } catch (error) {
      console.error('Multiple image generation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get image generation job status
   */
  static async getJobStatus(req, res) {
    try {
      const { jobId } = req.params;

      const job = await queues.imageGeneration.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const state = await job.getState();
      const progress = job.progress();
      const result = job.returnvalue;

      res.json({
        jobId: job.id,
        state,
        progress,
        result: state === 'completed' ? result : null,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
      });
    } catch (error) {
      console.error('Get job status error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ImageController;

