/**
 * Clear All Queue Jobs
 * Removes all failed, delayed, and stuck waiting jobs from all queues
 */

const { queues } = require('../src/queues');

async function clearAllQueues() {
  try {
    console.log('🧹 Starting queue cleanup...\n');

    const queueNames = [
      'batchProcessing',
      'pipeline',
      'scriptGeneration',
      'voiceGeneration',
      'imageGeneration',
      'videoProcessing',
      'transcription'
    ];

    let totalCleaned = 0;
    const summary = {};

    for (const queueName of queueNames) {
      try {
        const queue = queues[queueName];
        if (!queue) {
          console.log(`⏭️  Skipping ${queueName} (not found)`);
          continue;
        }

        console.log(`\n📋 Processing queue: ${queueName}`);

        // Get all job types
        const [failedJobs, completedJobs, delayedJobs, waitingJobs, activeJobs] = await Promise.all([
          queue.getFailed(0, 10000),
          queue.getCompleted(0, 10000),
          queue.getDelayed(0, 10000),
          queue.getWaiting(0, 10000),
          queue.getActive(0, 100)
        ]);

        let queueCleaned = 0;

        // Clean failed jobs
        console.log(`   ❌ Failed jobs: ${failedJobs.length}`);
        for (const job of failedJobs) {
          await job.remove();
          queueCleaned++;
        }

        // Clean old completed jobs (keep last 10)
        console.log(`   ✅ Completed jobs: ${completedJobs.length}`);
        const completedToRemove = completedJobs.slice(10); // Keep most recent 10
        for (const job of completedToRemove) {
          await job.remove();
          queueCleaned++;
        }

        // Clean delayed jobs
        console.log(`   ⏰ Delayed jobs: ${delayedJobs.length}`);
        for (const job of delayedJobs) {
          await job.remove();
          queueCleaned++;
        }

        // Clean old stuck waiting jobs (older than 5 minutes)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        let stuckCount = 0;
        console.log(`   ⏳ Waiting jobs: ${waitingJobs.length}`);
        for (const job of waitingJobs) {
          if (job.timestamp < fiveMinutesAgo) {
            await job.remove();
            queueCleaned++;
            stuckCount++;
          }
        }
        if (stuckCount > 0) {
          console.log(`   🔧 Removed ${stuckCount} stuck waiting jobs (>5min old)`);
        }

        // Show active jobs (don't remove these)
        console.log(`   🔄 Active jobs: ${activeJobs.length} (keeping these)`);

        summary[queueName] = {
          failed: failedJobs.length,
          completed: completedToRemove.length,
          delayed: delayedJobs.length,
          stuck: stuckCount,
          active: activeJobs.length,
          cleaned: queueCleaned
        };

        totalCleaned += queueCleaned;

        if (queueCleaned > 0) {
          console.log(`   ✅ Cleaned ${queueCleaned} jobs from ${queueName}`);
        }

      } catch (err) {
        console.error(`   ⚠️  Error processing ${queueName}:`, err.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 CLEANUP SUMMARY:');
    console.log('='.repeat(60));
    
    for (const [queueName, stats] of Object.entries(summary)) {
      if (stats.cleaned > 0) {
        console.log(`\n${queueName}:`);
        console.log(`  - Failed: ${stats.failed}`);
        console.log(`  - Old completed: ${stats.completed}`);
        console.log(`  - Delayed: ${stats.delayed}`);
        console.log(`  - Stuck: ${stats.stuck}`);
        console.log(`  - Active (kept): ${stats.active}`);
        console.log(`  ✅ Total cleaned: ${stats.cleaned}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ TOTAL JOBS CLEANED: ${totalCleaned}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
clearAllQueues()
  .then(() => {
    console.log('\n✅ Queue cleanup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Queue cleanup failed:', error);
    process.exit(1);
  });

