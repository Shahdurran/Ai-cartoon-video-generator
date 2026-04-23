const { 
  getAllQueuesStats, 
  getQueueStats, 
  cleanQueue, 
  pauseQueue, 
  resumeQueue,
  getJob 
} = require('../queues');

class QueueController {
  /**
   * Get all queues status
   */
  static async getAllQueuesStatus(req, res) {
    try {
      const includeJobs = req.query.includeJobs === 'true' || req.query.includeJobs === true;
      const stats = await getAllQueuesStats(includeJobs);

      res.json({
        success: true,
        queues: stats,
      });
    } catch (error) {
      console.error('Get all queues status error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get specific queue status
   */
  static async getQueueStatus(req, res) {
    try {
      const { queueName } = req.params;

      const stats = await getQueueStats(queueName);

      res.json({
        success: true,
        queue: stats,
      });
    } catch (error) {
      console.error('Get queue status error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Clean a queue (remove completed/failed jobs)
   */
  static async cleanQueue(req, res) {
    try {
      const { queueName } = req.params;
      const { grace = 0 } = req.body;

      await cleanQueue(queueName, grace);

      res.json({
        success: true,
        message: `Queue ${queueName} cleaned successfully`,
      });
    } catch (error) {
      console.error('Clean queue error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Pause a queue
   */
  static async pauseQueue(req, res) {
    try {
      const { queueName } = req.params;

      await pauseQueue(queueName);

      res.json({
        success: true,
        message: `Queue ${queueName} paused successfully`,
      });
    } catch (error) {
      console.error('Pause queue error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Resume a queue
   */
  static async resumeQueue(req, res) {
    try {
      const { queueName } = req.params;

      await resumeQueue(queueName);

      res.json({
        success: true,
        message: `Queue ${queueName} resumed successfully`,
      });
    } catch (error) {
      console.error('Resume queue error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get job status by ID
   */
  static async getJobStatus(req, res) {
    try {
      const { queueName, jobId } = req.params;

      const jobInfo = await getJob(queueName, jobId);

      res.json({
        success: true,
        job: jobInfo,
      });
    } catch (error) {
      console.error('Get job status error:', error);
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * Delete a job from the queue
   */
  static async deleteJob(req, res) {
    try {
      const { queueName, jobId } = req.params;

      const { removeJob } = require('../queues');
      await removeJob(queueName, jobId);

      res.json({
        success: true,
        message: `Job ${jobId} removed from queue ${queueName}`,
      });
    } catch (error) {
      console.error('Delete job error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = QueueController;

