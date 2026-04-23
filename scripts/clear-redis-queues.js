#!/usr/bin/env node

/**
 * Emergency Redis Queue Cleaner
 * Stops all jobs and clears all queues in Redis
 */

const Bull = require('bull');
const { queueConfig, QUEUE_NAMES } = require('../src/config/queue.config');

const QUEUE_LIST = [
  QUEUE_NAMES.SCRIPT_GENERATION,
  QUEUE_NAMES.IMAGE_GENERATION,
  QUEUE_NAMES.VOICE_GENERATION,
  QUEUE_NAMES.VIDEO_PROCESSING,
  QUEUE_NAMES.BATCH_PROCESSING,
  QUEUE_NAMES.TRANSCRIPTION,
  'pipeline',
];

async function clearAllQueues() {
  console.log('🚨 EMERGENCY: Clearing all Redis queues...\n');

  const queues = {};
  
  // Create queue instances
  for (const queueName of QUEUE_LIST) {
    queues[queueName] = new Bull(queueName, queueConfig);
  }

  // Step 1: Pause all queues immediately
  console.log('⏸️  Step 1: Pausing all queues...');
  for (const [name, queue] of Object.entries(queues)) {
    try {
      await queue.pause(true, true);
      console.log(`   ✅ Paused: ${name}`);
    } catch (error) {
      console.log(`   ⚠️  ${name}: ${error.message}`);
    }
  }

  console.log('\n🗑️  Step 2: Removing all jobs...');
  
  for (const [name, queue] of Object.entries(queues)) {
    try {
      console.log(`\n   📦 Clearing ${name}...`);
      
      // Get counts before
      const [waiting, active, delayed, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getDelayedCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ]);
      
      const total = waiting + active + delayed + completed + failed;
      
      if (total === 0) {
        console.log(`   ✓ ${name}: Empty (no jobs)`);
        continue;
      }
      
      console.log(`   📊 Found: ${waiting} waiting, ${active} active, ${delayed} delayed, ${completed} completed, ${failed} failed`);
      
      // Remove all active jobs first
      if (active > 0) {
        const activeJobs = await queue.getActive();
        for (const job of activeJobs) {
          try {
            await job.moveToFailed({ message: 'Force stopped by clear-redis-queues script' }, true);
          } catch (err) {
            // Try to remove it anyway
            try {
              await job.remove();
            } catch (e) {
              console.log(`   ⚠️  Could not remove job ${job.id}`);
            }
          }
        }
        console.log(`   ✅ Stopped ${active} active job(s)`);
      }
      
      // Empty the queue (removes waiting, delayed, completed, failed)
      await queue.empty();
      console.log(`   ✅ Emptied ${name} queue`);
      
      // Clean completed and failed jobs
      await queue.clean(0, 'completed');
      await queue.clean(0, 'failed');
      console.log(`   ✅ Cleaned ${name} history`);
      
    } catch (error) {
      console.error(`   ❌ Error clearing ${name}:`, error.message);
    }
  }

  console.log('\n🔌 Step 3: Closing connections...');
  for (const [name, queue] of Object.entries(queues)) {
    try {
      await queue.close();
      console.log(`   ✅ Closed: ${name}`);
    } catch (error) {
      console.log(`   ⚠️  ${name}: ${error.message}`);
    }
  }

  console.log('\n✅ All queues cleared and stopped!');
  console.log('✅ You can now safely restart the backend.\n');
  
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});

// Run
clearAllQueues().catch(error => {
  console.error('\n❌ Failed to clear queues:', error);
  process.exit(1);
});

