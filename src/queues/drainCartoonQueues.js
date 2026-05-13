/**
 * Drain all cartoon Bull queues (waiting, delayed, completed, failed, active).
 * Used on container boot when CLEAR_BULL_QUEUES_ON_START=true so stale Redis
 * jobs from a previous run cannot replay against a fresh DB/filesystem.
 */

const { queues } = require('./cartoonQueues');

async function drainCartoonQueues() {
  console.log('🧹 CLEAR_BULL_QUEUES_ON_START: draining cartoon Redis queues…');

  for (const [name, queue] of Object.entries(queues)) {
    try {
      await queue.pause(true, true);

      const activeJobs = await queue.getActive();
      for (const job of activeJobs) {
        try {
          await job.remove();
        } catch {
          try {
            await job.moveToFailed({ message: 'Removed on startup queue drain' }, true);
          } catch {
            /* ignore */
          }
        }
      }

      await queue.empty();
      await queue.clean(0, 'completed', 50000);
      await queue.clean(0, 'failed', 50000);
      await queue.clean(0, 'delayed', 50000);

      await queue.resume(true);
      console.log(`   ✓ Drained queue: ${name}`);
    } catch (err) {
      console.warn(`   ⚠️  Could not fully drain ${name}:`, err.message);
      try {
        await queue.resume(true);
      } catch {
        /* ignore */
      }
    }
  }

  console.log('✅ Cartoon queue drain finished');
}

module.exports = { drainCartoonQueues };
