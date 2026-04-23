/**
 * Express Application Setup
 * Main application configuration and middleware
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');

// Import routes
const routes = require('./routes');

// Import queue setup
const { setupProcessors } = require('./queues/setupProcessors');
const { setupCartoonProcessors } = require('./queues/setupCartoonProcessors');
const { runMigrations } = require('./db/migrate');

// Initialize Express app
const app = express();

// ===== Middleware =====
// Enable CORS for frontend (allow all localhost ports in development)
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all localhost origins in development
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    
    // In production, you would check against a whitelist
    callback(null, true);
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ===== Static File Serving =====
// Serve static files with CORS headers
app.use('/public', cors(), express.static(path.join(__dirname, '../public')));
app.use('/test-output', cors(), express.static(path.join(__dirname, '../test-output')));
app.use('/output', cors(), express.static(path.join(__dirname, '../output')));
app.use('/temp', cors(), express.static(path.join(__dirname, '../temp'))); // For audio/image preview
app.use('/music-library', cors(), express.static(path.join(__dirname, '../music-library')));
app.use('/person-videos', cors(), express.static(path.join(__dirname, '../person-videos')));
app.use('/sound-waves', cors(), express.static(path.join(__dirname, '../sound-waves')));

// ===== API Routes =====
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'FFmpeg Video Generator API',
    version: '2.0.0',
    description: 'Advanced video generator with AI integrations and job queue management',
    endpoints: {
      health: '/api/health',
      queues: '/api/v2/queue',
      script: '/api/v2/script',
      voice: '/api/v2/voice',
      image: '/api/v2/image',
      channel: '/api/v2/channel',
      batch: '/api/v2/batch',
      video: '/api/video',
    },
    documentation: 'https://github.com/your-repo/readme',
  });
});

// ===== Error Handling Middleware =====
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
  });
});

// ===== Initialize Queue Processors =====
setupProcessors();
try {
  setupCartoonProcessors();
} catch (err) {
  console.warn('⚠️  Cartoon processors not initialised:', err.message);
}

// ===== Optional: run migrations on startup (Railway) =====
if (process.env.RUN_MIGRATIONS_ON_STARTUP === 'true' && process.env.DATABASE_URL) {
  runMigrations({ silent: false }).catch((err) => {
    console.error('❌ Startup migrations failed:', err.message);
  });
}

// ===== Optional: seed styles + music tracks when requested =====
if (process.env.RUN_SEED_ON_STARTUP === 'true' && process.env.DATABASE_URL) {
  require('./db/seed').main().catch((err) => {
    console.error('❌ Startup seed failed:', err.message);
  });
}

// ===== Ensure Required Directories =====
async function ensureDirectories() {
  const directories = [
    path.join(__dirname, '../public/videos'),
    path.join(__dirname, '../public/thumbnails'),
    path.join(__dirname, '../test-output'),
    path.join(__dirname, '../output'),
    path.join(__dirname, '../temp'),
    path.join(__dirname, '../video-bank'),
    path.join(__dirname, '../music-library'),
    path.join(__dirname, '../storage/channels'),
    path.join(__dirname, '../storage/templates'),
    path.join(__dirname, '../storage/projects'),
    path.join(__dirname, '../storage/batches'),
    path.join(__dirname, '../storage/generated-assets'), // For step-by-step sessions
    path.join(__dirname, '../effects'),
  ];

  for (const dir of directories) {
    await fs.ensureDir(dir);
  }

  console.log('✅ All required directories ensured');
}

ensureDirectories();

// ===== Graceful Shutdown Handlers =====
const { closeQueues } = require('./queues');

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log('⚠️  Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  console.log(`\n🛑 ${signal} received. Starting immediate shutdown...`);
  console.log('⏸️  Halting all active jobs and pausing queues...\n');

  try {
    // Close all queues (this now pauses, stops jobs, and closes)
    await closeQueues();

    console.log('\n✅ Shutdown complete. All jobs halted.');
    console.log('👋 Server stopped. Goodbye!\n');
    
    // Exit immediately (no delay)
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle various shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon restart

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejection, just log it
});

module.exports = app;

