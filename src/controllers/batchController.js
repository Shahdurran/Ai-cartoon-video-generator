const { queues } = require('../queues');
const { JOB_PRIORITIES } = require('../config/queue.config');
const StorageService = require('../services/storageService');

class BatchController {
  /**
   * Create and start a batch processing job
   */
  static async createBatch(req, res) {
    try {
      const { videos, batchConfig = {}, priority = 'normal' } = req.body;

      if (!videos || !Array.isArray(videos) || videos.length === 0) {
        return res.status(400).json({ error: 'Videos array is required' });
      }

      const storageService = new StorageService();

      // ===== CLEAN UP FAILED/STUCK JOBS BEFORE STARTING NEW BATCH =====
      console.log('\n🧹 Cleaning up failed/stuck jobs from all queues before starting new batch...');
      
      const queuesToClear = [
        'batchProcessing',
        'pipeline',
        'scriptGeneration',
        'voiceGeneration',
        'imageGeneration',
        'videoProcessing'
      ];

      let totalCleaned = 0;
      
      for (const queueName of queuesToClear) {
        try {
          const queue = queues[queueName];
          if (!queue) continue;

          // Get failed and stuck jobs
          const [failedJobs, delayedJobs, waitingJobs] = await Promise.all([
            queue.getFailed(0, 1000),
            queue.getDelayed(0, 1000),
            queue.getWaiting(0, 1000)
          ]);

          // Clean failed jobs
          for (const job of failedJobs) {
            await job.remove();
            totalCleaned++;
          }

          // Clean old stuck waiting jobs (older than 5 minutes)
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          for (const job of waitingJobs) {
            if (job.timestamp < fiveMinutesAgo) {
              await job.remove();
              totalCleaned++;
            }
          }

          // Clean delayed jobs
          for (const job of delayedJobs) {
            await job.remove();
            totalCleaned++;
          }

          if (failedJobs.length > 0 || delayedJobs.length > 0) {
            console.log(`   ✅ ${queueName}: Cleaned ${failedJobs.length} failed, ${delayedJobs.length} delayed jobs`);
          }
        } catch (err) {
          console.error(`   ⚠️  Error cleaning ${queueName}:`, err.message);
        }
      }

      if (totalCleaned > 0) {
        console.log(`✅ Total cleaned: ${totalCleaned} old/failed jobs\n`);
      } else {
        console.log(`✅ No old jobs to clean\n`);
      }

      // Create batch record
      const batchId = await storageService.saveBatch({
        videos,
        config: batchConfig,
        status: 'pending',
        totalCount: videos.length,
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
      });

      // Add batch to queue
      const job = await queues.batchProcessing.add(
        {
          batchId,
          videos,
        },
        {
          priority: JOB_PRIORITIES[priority.toUpperCase()] || JOB_PRIORITIES.NORMAL,
        }
      );

      res.json({
        success: true,
        batchId,
        jobId: job.id,
        message: `Batch processing started with ${videos.length} videos`,
        cleanedJobs: totalCleaned,
        status: await job.getState(),
      });
    } catch (error) {
      console.error('Create batch error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get batch status
   */
  static async getBatchStatus(req, res) {
    try {
      const { batchId } = req.params;

      const storageService = new StorageService();
      const batch = await storageService.getBatch(batchId);

      res.json({
        success: true,
        batch,
      });
    } catch (error) {
      console.error('Get batch status error:', error);
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * Get batch job status from queue
   */
  static async getJobStatus(req, res) {
    try {
      const { jobId } = req.params;

      const job = await queues.batchProcessing.getJob(jobId);
      
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

  /**
   * List all batches
   */
  static async listBatches(req, res) {
    try {
      const storageService = new StorageService();
      
      // Read all batch files
      const fs = require('fs-extra');
      const path = require('path');
      const batchesDir = path.join(storageService.storagePath, 'batches');
      
      const files = await fs.readdir(batchesDir);
      const batches = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const batchPath = path.join(batchesDir, file);
          const batch = await fs.readJson(batchPath);
          batches.push(batch);
        }
      }

      // Sort by creation date (newest first)
      batches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.json({
        success: true,
        batches,
        count: batches.length,
      });
    } catch (error) {
      console.error('List batches error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = BatchController;

