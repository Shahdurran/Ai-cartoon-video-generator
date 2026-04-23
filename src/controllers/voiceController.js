const { queues } = require('../queues');
const { JOB_PRIORITIES } = require('../config/queue.config');
const VoiceService = require('../services/voiceService');

class VoiceController {
  /**
   * Generate voice from text
   */
  static async generateVoice(req, res) {
    try {
      const { 
        text, 
        voice, 
        speed = 1.0, 
        projectId, 
        outputDir,
        useFallback = false,
        priority = 'normal' 
      } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      // Add job to queue
      const job = await queues.voiceGeneration.add(
        {
          text,
          options: {
            voice,
            speed,
            useFallback,
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
        message: 'Voice generation job queued',
        status: await job.getState(),
      });
    } catch (error) {
      console.error('Voice generation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get available voices
   */
  static async getAvailableVoices(req, res) {
    try {
      const voiceService = new VoiceService();
      const voices = await voiceService.getAvailableVoices();

      res.json({
        success: true,
        voices,
      });
    } catch (error) {
      console.error('Get voices error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get voice generation job status
   */
  static async getJobStatus(req, res) {
    try {
      const { jobId } = req.params;

      const job = await queues.voiceGeneration.getJob(jobId);
      
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

module.exports = VoiceController;

