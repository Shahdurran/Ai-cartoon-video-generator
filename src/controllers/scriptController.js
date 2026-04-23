const { queues } = require('../queues');
const { JOB_PRIORITIES } = require('../config/queue.config');
const StorageService = require('../services/storageService');

class ScriptController {
  /**
   * Generate a video script
   */
  static async generateScript(req, res) {
    try {
      const { prompt, options = {}, projectId, priority = 'normal' } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // Add job to queue
      const job = await queues.scriptGeneration.add(
        {
          prompt,
          options,
          projectId,
        },
        {
          priority: JOB_PRIORITIES[priority.toUpperCase()] || JOB_PRIORITIES.NORMAL,
        }
      );

      res.json({
        success: true,
        jobId: job.id,
        message: 'Script generation job queued',
        status: await job.getState(),
      });
    } catch (error) {
      console.error('Script generation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Generate image prompts from script
   */
  static async generateImagePrompts(req, res) {
    try {
      const { script, numberOfImages = 5, projectId, priority = 'normal' } = req.body;

      if (!script) {
        return res.status(400).json({ error: 'Script is required' });
      }

      // Add job to queue
      const job = await queues.scriptGeneration.add(
        {
          type: 'image-prompts',
          script,
          numberOfImages,
          projectId,
        },
        {
          priority: JOB_PRIORITIES[priority.toUpperCase()] || JOB_PRIORITIES.NORMAL,
        }
      );

      res.json({
        success: true,
        jobId: job.id,
        message: 'Image prompt generation job queued',
        status: await job.getState(),
      });
    } catch (error) {
      console.error('Image prompt generation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Refine an existing script
   */
  static async refineScript(req, res) {
    try {
      const { script, instructions, projectId, priority = 'normal' } = req.body;

      if (!script || !instructions) {
        return res.status(400).json({ error: 'Script and instructions are required' });
      }

      // Add job to queue
      const job = await queues.scriptGeneration.add(
        {
          type: 'refine',
          script,
          instructions,
          projectId,
        },
        {
          priority: JOB_PRIORITIES[priority.toUpperCase()] || JOB_PRIORITIES.NORMAL,
        }
      );

      res.json({
        success: true,
        jobId: job.id,
        message: 'Script refinement job queued',
        status: await job.getState(),
      });
    } catch (error) {
      console.error('Script refinement error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get script generation job status
   */
  static async getJobStatus(req, res) {
    try {
      const { jobId } = req.params;

      const job = await queues.scriptGeneration.getJob(jobId);
      
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

module.exports = ScriptController;

