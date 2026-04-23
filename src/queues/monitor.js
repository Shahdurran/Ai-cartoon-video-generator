#!/usr/bin/env node

/**
 * Queue Monitor - CLI tool to monitor Bull queues
 * Usage: node src/queues/monitor.js
 */

require('dotenv').config();
const { getAllQueuesStats } = require('./index');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function colorize(text, color) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function formatQueueStats(queueName, stats) {
  const lines = [];
  
  lines.push(colorize(`\n📊 Queue: ${queueName}`, 'bright'));
  lines.push(colorize('━'.repeat(50), 'cyan'));
  
  lines.push(`  ⏳ Waiting:   ${colorize(stats.waiting, 'yellow')}`);
  lines.push(`  ▶️  Active:    ${colorize(stats.active, 'green')}`);
  lines.push(`  ✅ Completed: ${colorize(stats.completed, 'green')}`);
  lines.push(`  ❌ Failed:    ${colorize(stats.failed, 'red')}`);
  lines.push(`  ⏸️  Delayed:   ${colorize(stats.delayed, 'yellow')}`);
  lines.push(`  ⏸️  Paused:    ${colorize(stats.paused, 'yellow')}`);
  lines.push(colorize('━'.repeat(50), 'cyan'));
  lines.push(`  📈 Total:     ${colorize(stats.total, 'bright')}`);
  
  return lines.join('\n');
}

async function displayStats() {
  try {
    console.clear();
    console.log(colorize('🔍 Bull Queue Monitor', 'bright'));
    console.log(colorize('═'.repeat(50), 'cyan'));
    console.log(colorize(`Last Update: ${new Date().toLocaleString()}`, 'blue'));
    
    const allStats = await getAllQueuesStats();
    
    // Calculate totals
    let totalWaiting = 0;
    let totalActive = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    
    // Display each queue
    for (const [queueName, stats] of Object.entries(allStats)) {
      console.log(formatQueueStats(queueName, stats));
      
      totalWaiting += stats.waiting;
      totalActive += stats.active;
      totalCompleted += stats.completed;
      totalFailed += stats.failed;
    }
    
    // Display summary
    console.log(colorize('\n📊 OVERALL SUMMARY', 'bright'));
    console.log(colorize('═'.repeat(50), 'cyan'));
    console.log(`  Total Waiting:   ${colorize(totalWaiting, 'yellow')}`);
    console.log(`  Total Active:    ${colorize(totalActive, 'green')}`);
    console.log(`  Total Completed: ${colorize(totalCompleted, 'green')}`);
    console.log(`  Total Failed:    ${colorize(totalFailed, 'red')}`);
    console.log(colorize('═'.repeat(50), 'cyan'));
    
    console.log(colorize('\n⌨️  Press Ctrl+C to exit', 'cyan'));
    
  } catch (error) {
    console.error(colorize(`\n❌ Error: ${error.message}`, 'red'));
    console.log(colorize('\nMake sure Redis is running and accessible.', 'yellow'));
    process.exit(1);
  }
}

async function startMonitor() {
  console.log(colorize('🚀 Starting Queue Monitor...', 'green'));
  console.log(colorize('Connecting to Redis...', 'cyan'));
  
  // Display initial stats
  await displayStats();
  
  // Refresh every 5 seconds
  const interval = setInterval(async () => {
    await displayStats();
  }, 5000);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(colorize('\n\n👋 Shutting down monitor...', 'yellow'));
    clearInterval(interval);
    process.exit(0);
  });
}

// Start the monitor
startMonitor().catch((error) => {
  console.error(colorize(`\n❌ Failed to start monitor: ${error.message}`, 'red'));
  process.exit(1);
});

