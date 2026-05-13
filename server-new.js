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
const { setupCartoonProcessors } = require('./src/queues/setupCartoonProcessors');

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

let server;

async function bootstrapQueues() {
  try {
    await setupCartoonProcessors();
  } catch (err) {
    console.warn('⚠️  Cartoon processors not initialised:', err.message);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);

  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
    });
  }

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

(async () => {
  await bootstrapQueues();

  server = app.listen(PORT, HOST, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 AI Cartoon Generator API v2.0.0');
    console.log('='.repeat(60));
    console.log(`📍 Server running on: http://${HOST}:${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Cartoon queue monitor: npm run queue:monitor`);
    console.log('='.repeat(60));
    console.log('\n✨ Pipeline:');
    console.log('  • Bull + Redis (cartoon queues only)');
    console.log('  • Claude, Fal.AI / Higgsfield, ElevenLabs, AssemblyAI, FFmpeg');
    console.log('\n📚 Entrypoints:');
    console.log(`  Main: http://${HOST}:${PORT}/`);
    console.log(`  Health: http://${HOST}:${PORT}/api/health`);
    console.log('='.repeat(60) + '\n');
  });
})();

module.exports = app;
