/**
 * Server Entry Point
 * Starts the Express server with Bull queue support
 */

const path = require('path');
// Always load repo-root .env (not cwd) so keys work when the server is
// started from another directory.
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const app = require('./src/app');
const { closeQueues } = require('./src/queues');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 FFmpeg Video Generator Server v2.0.0');
  console.log('='.repeat(60));
  console.log(`📍 Server running on: http://${HOST}:${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Queue monitoring: npm run queue:monitor`);
  console.log('='.repeat(60));
  console.log('\n✨ Features:');
  console.log('  • Bull Queue with Redis for job management');
  console.log('  • Claude API for script generation');
  console.log('  • Fal.AI for image generation');
  console.log('  • Genaipro.vn for voice generation (primary)');
  console.log('  • AssemblyAI for transcription');
  console.log('  • Batch video processing');
  console.log('  • Channel & template management');
  console.log('\n📚 API Documentation:');
  console.log(`  Main: http://${HOST}:${PORT}/`);
  console.log(`  Health: http://${HOST}:${PORT}/api/health`);
  console.log(`  Queues: http://${HOST}:${PORT}/api/v2/queue`);
  console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);
  
  // Close server
  server.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Close queues
  try {
    await closeQueues();
    console.log('✅ All queues closed');
  } catch (error) {
    console.error('❌ Error closing queues:', error);
  }

  console.log('👋 Goodbye!\n');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = server;

