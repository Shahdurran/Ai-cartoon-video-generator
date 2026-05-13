/**
 * Cartoon generator Bull queues only (legacy channel/batch queues removed).
 */

const { queues } = require('./cartoonQueues');

async function formatJob(job) {
  const state = await job.getState();
  return {
    id: job.id,
    name: job.name,
    data: job.data,
    state,
    status: state,
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

  if (includeJobs) {
    const [waitingJobs, activeJobs, completedJobs, failedJobs] = await Promise.all([
      queue.getWaiting(0, 50),
      queue.getActive(0, 50),
      queue.getCompleted(0, 20),
      queue.getFailed(0, 20),
    ]);

    stats.jobs = {
      waiting: await Promise.all(waitingJobs.map((job) => formatJob(job))),
      active: await Promise.all(activeJobs.map((job) => formatJob(job))),
      completed: await Promise.all(completedJobs.map((job) => formatJob(job))),
      failed: await Promise.all(failedJobs.map((job) => formatJob(job))),
    };
  }

  return stats;
}

async function getAllQueuesStats(includeJobs = false) {
  const stats = {};
  for (const name of Object.keys(queues)) {
    stats[name] = await getQueueStats(name, includeJobs);
  }
  return stats;
}

async function cleanQueue(queueName, grace = 0) {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue not found: ${queueName}`);
  }
  await queue.clean(grace, 'completed');
  await queue.clean(grace, 'failed');
  console.log(`🧹 Cleaned queue: ${queueName}`);
}

let isClosingQueues = false;

async function closeQueues() {
  if (isClosingQueues) {
    console.log('⚠️  Queue shutdown already in progress, skipping...');
    return;
  }

  isClosingQueues = true;
  console.log('🔄 Shutting down cartoon queues...');

  console.log('⏸️  Pausing all queues...');
  for (const [name, queue] of Object.entries(queues)) {
    try {
      if (queue.client && queue.client.status === 'ready') {
        await queue.pause(true, true);
        console.log(`   ⏸️  Paused: ${name}`);
      } else {
        console.log(`   ⏭️  Skipped ${name} (Redis not ready)`);
      }
    } catch (error) {
      if (!error.message.includes('already connecting')) {
        console.warn(`   ⚠️  Failed to pause ${name}:`, error.message);
      } else {
        console.log(`   ⏭️  Skipped ${name} (connecting)`);
      }
    }
  }

  console.log('🛑 Stopping active jobs...');
  for (const [name, queue] of Object.entries(queues)) {
    try {
      const activeJobs = await queue.getActive();
      if (activeJobs.length > 0) {
        console.log(`   🛑 ${name}: ${activeJobs.length} active job(s)`);
        for (const job of activeJobs) {
          try {
            const jobState = await job.getState();
            if (jobState === 'active') {
              await job.moveToFailed({ message: 'Server shutdown - job interrupted' }, true);
              console.log(`   ✅ Stopped job ${job.id}`);
            }
          } catch (err) {
            console.log(`   ⏭️  Job ${job.id}: ${err.message}`);
          }
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  Error stopping jobs in ${name}:`, error.message);
    }
  }

  console.log('🔌 Closing queue connections...');
  for (const [name, queue] of Object.entries(queues)) {
    try {
      await queue.close();
      console.log(`   ✅ Closed: ${name}`);
    } catch (error) {
      console.warn(`   ⚠️  Failed to close ${name}:`, error.message);
    }
  }

  console.log('✅ All cartoon queues shut down');
}

module.exports = {
  queues,
  getQueueStats,
  getAllQueuesStats,
  cleanQueue,
  closeQueues,
};
