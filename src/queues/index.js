const Bull = require('bull');
const { queueConfig, QUEUE_NAMES } = require('../config/queue.config');

// Create queue instances
const queues = {
  scriptGeneration: new Bull(QUEUE_NAMES.SCRIPT_GENERATION, queueConfig),
  imageGeneration: new Bull(QUEUE_NAMES.IMAGE_GENERATION, queueConfig),
  voiceGeneration: new Bull(QUEUE_NAMES.VOICE_GENERATION, queueConfig),
  videoProcessing: new Bull(QUEUE_NAMES.VIDEO_PROCESSING, queueConfig),
  batchProcessing: new Bull(QUEUE_NAMES.BATCH_PROCESSING, queueConfig),
  transcription: new Bull(QUEUE_NAMES.TRANSCRIPTION, queueConfig),
  pipeline: new Bull('pipeline', queueConfig), // Master pipeline queue
};

/**
 * Get queue by name
 * @param {string} queueName - Name of the queue
 * @returns {Bull.Queue} Queue instance
 */
function getQueue(queueName) {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue not found: ${queueName}`);
  }
  return queue;
}

// Setup event listeners for all queues
Object.entries(queues).forEach(([name, queue]) => {
  queue.on('error', (error) => {
    console.error(`❌ Queue ${name} error:`, error);
  });

  queue.on('waiting', (jobId) => {
    console.log(`⏳ Job ${jobId} is waiting in queue ${name}`);
  });

  queue.on('active', (job) => {
    console.log(`▶️  Job ${job.id} started in queue ${name}`);
  });

  queue.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed in queue ${name}`);
  });

  queue.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed in queue ${name}:`, err.message);
  });

  queue.on('progress', (job, progress) => {
    console.log(`📊 Job ${job.id} progress in queue ${name}: ${progress}%`);
  });

  queue.on('stalled', (job) => {
    console.warn(`⚠️  Job ${job.id} stalled in queue ${name}`);
  });
});

/**
 * Get queue statistics
 * @param {string} queueName - Name of the queue
 * @param {boolean} includeJobs - Whether to include job details
 * @returns {Promise<object>} Queue statistics
 */
async function getQueueStats(queueName, includeJobs = false) {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue not found: ${queueName}`);
  }

  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getPausedCount(),
  ]);

  const stats = {
    queueName,
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    total: waiting + active + completed + failed + delayed,
  };

  // Include actual job details if requested
  if (includeJobs) {
    const [waitingJobs, activeJobs, completedJobs, failedJobs] = await Promise.all([
      queue.getWaiting(0, 50), // Get up to 50 waiting jobs
      queue.getActive(0, 50),   // Get up to 50 active jobs
      queue.getCompleted(0, 20), // Get last 20 completed jobs
      queue.getFailed(0, 20),    // Get last 20 failed jobs
    ]);

    stats.jobs = {
      waiting: await Promise.all(waitingJobs.map(job => formatJob(job))),
      active: await Promise.all(activeJobs.map(job => formatJob(job))),
      completed: await Promise.all(completedJobs.map(job => formatJob(job))),
      failed: await Promise.all(failedJobs.map(job => formatJob(job))),
    };
  }

  return stats;
}

/**
 * Format job for API response
 * @private
 */
async function formatJob(job) {
  const state = await job.getState();
  return {
    id: job.id,
    name: job.name,
    data: job.data,
    state,
    status: state, // Alias for compatibility
    progress: job.progress(),
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    returnvalue: job.returnvalue,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
    timestamp: job.timestamp,
    opts: job.opts,
  };
}

/**
 * Get all queues statistics
 * @param {boolean} includeJobs - Whether to include job details
 * @returns {Promise<object>} All queues statistics
 */
async function getAllQueuesStats(includeJobs = false) {
  const stats = {};
  
  for (const [name, queue] of Object.entries(queues)) {
    stats[name] = await getQueueStats(name, includeJobs);
  }

  return stats;
}

/**
 * Clean completed jobs from queue
 * @param {string} queueName - Name of the queue
 * @param {number} grace - Grace period in milliseconds
 */
async function cleanQueue(queueName, grace = 0) {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue not found: ${queueName}`);
  }

  await queue.clean(grace, 'completed');
  await queue.clean(grace, 'failed');
  console.log(`🧹 Cleaned queue: ${queueName}`);
}

/**
 * Pause a queue
 * @param {string} queueName - Name of the queue
 */
async function pauseQueue(queueName) {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue not found: ${queueName}`);
  }

  await queue.pause();
  console.log(`⏸️  Paused queue: ${queueName}`);
}

/**
 * Resume a queue
 * @param {string} queueName - Name of the queue
 */
async function resumeQueue(queueName) {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue not found: ${queueName}`);
  }

  await queue.resume();
  console.log(`▶️  Resumed queue: ${queueName}`);
}

/**
 * Get job by ID
 * @param {string} queueName - Name of the queue
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} Job object
 */
async function getJob(queueName, jobId) {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue not found: ${queueName}`);
  }

  const job = await queue.getJob(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // Get job state (completed, failed, active, waiting, etc.)
  const state = await job.getState();

  return {
    id: job.id,
    name: job.name,
    data: job.data,
    state: state,
    status: state, // Alias for compatibility
    progress: job.progress(),
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace,
    returnvalue: job.returnvalue,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
    timestamp: job.timestamp,
  };
}

/**
 * Remove a job from the queue
 * @param {string} queueName - Name of the queue
 * @param {string} jobId - Job ID
 */
async function removeJob(queueName, jobId) {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue not found: ${queueName}`);
  }

  const job = await queue.getJob(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  await job.remove();
  console.log(`🗑️  Removed job ${jobId} from queue ${queueName}`);
}

// Global flag to prevent multiple simultaneous shutdowns
let isClosingQueues = false;

/**
 * Graceful shutdown - pause and close all queues
 */
async function closeQueues() {
  // Prevent duplicate shutdown attempts
  if (isClosingQueues) {
    console.log('⚠️  Queue shutdown already in progress, skipping...');
    return;
  }
  
  isClosingQueues = true;
  console.log('🔄 Shutting down all queues...');
  
  // Step 1: Pause all queues immediately to stop accepting new jobs
  console.log('⏸️  Pausing all queues...');
  for (const [name, queue] of Object.entries(queues)) {
    try {
      // Check if queue client is ready before pausing
      if (queue.client && queue.client.status === 'ready') {
        await queue.pause(true, true); // (isLocal=true, doNotWaitActive=true)
        console.log(`   ⏸️  Paused: ${name}`);
      } else {
        console.log(`   ⏭️  Skipped ${name} (Redis not ready)`);
      }
    } catch (error) {
      // Ignore "already connecting" errors - queue will be closed anyway
      if (!error.message.includes('already connecting')) {
        console.warn(`   ⚠️  Failed to pause ${name}:`, error.message);
      } else {
        console.log(`   ⏭️  Skipped ${name} (connecting)`);
      }
    }
  }
  
  // Step 2: Get active jobs and attempt to gracefully stop them
  console.log('🛑 Stopping active jobs...');
  for (const [name, queue] of Object.entries(queues)) {
    try {
      const activeJobs = await queue.getActive();
      if (activeJobs.length > 0) {
        console.log(`   🛑 ${name}: ${activeJobs.length} active job(s) - attempting to stop`);
        
        // Mark active jobs as failed with shutdown reason
        for (const job of activeJobs) {
          try {
            // Check job state before trying to move it
            const jobState = await job.getState();
            
            if (jobState === 'active') {
              await job.moveToFailed({
                message: 'Server shutdown - job interrupted'
              }, true);
              console.log(`   ✅ Stopped job ${job.id}`);
            } else {
              console.log(`   ⏭️  Skipping job ${job.id} (state: ${jobState})`);
            }
          } catch (err) {
            // Silently skip jobs that can't be moved (they're already in another state)
            console.log(`   ⏭️  Job ${job.id}: ${err.message}`);
          }
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  Error stopping jobs in ${name}:`, error.message);
    }
  }
  
  // Step 3: Close queue connections
  console.log('🔌 Closing queue connections...');
  for (const [name, queue] of Object.entries(queues)) {
    try {
      await queue.close();
      console.log(`   ✅ Closed: ${name}`);
    } catch (error) {
      console.warn(`   ⚠️  Failed to close ${name}:`, error.message);
    }
  }
  
  console.log('✅ All queues shut down');
}

// NOTE: Graceful shutdown handlers are in src/app.js to avoid duplicate handlers

module.exports = {
  queues,
  getQueue,
  getQueueStats,
  closeQueues,
  getAllQueuesStats,
  cleanQueue,
  pauseQueue,
  resumeQueue,
  getJob,
  removeJob,
  closeQueues,
};

