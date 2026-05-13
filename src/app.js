/**
 * Express Application Setup
 * Main application configuration and middleware
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');

// Import routes
const routes = require('./routes');

const { runMigrations } = require('./db/migrate');

// Initialize Express app
const app = express();

// ===== Middleware =====
// Enable CORS for the Next.js web app (allow all localhost ports in development)
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

// ===== API Routes =====
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'AI Cartoon Generator API',
    version: '2.0.0',
    description: 'REST API for the Next.js web app (projects, styles, voices, music, queues)',
    endpoints: {
      health: '/api/health',
      styles: '/api/styles',
      projects: '/api/projects',
      voices: '/api/voices',
      music: '/api/music',
    },
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

// ===== Optional: run migrations + seed on startup (Railway) =====
// Seeding must wait for migrations to finish, otherwise it hits a db where
// the tables don't exist yet.
(async () => {
  if (process.env.RUN_MIGRATIONS_ON_STARTUP === 'true' && process.env.DATABASE_URL) {
    try {
      await runMigrations({ silent: false });
    } catch (err) {
      console.error('❌ Startup migrations failed:', err.message);
      return;
    }
  }
  if (process.env.RUN_SEED_ON_STARTUP === 'true' && process.env.DATABASE_URL) {
    try {
      await require('./db/seed').main();
    } catch (err) {
      console.error('❌ Startup seed failed:', err.message);
    }
  }
})();

// ===== Ensure Required Directories =====
async function ensureDirectories() {
  const directories = [
    path.join(__dirname, '../public/videos'),
    path.join(__dirname, '../public/fonts'),
    path.join(__dirname, '../public/thumbnails'),
    path.join(__dirname, '../test-output'),
    path.join(__dirname, '../output'),
    path.join(__dirname, '../temp'),
    path.join(__dirname, '../music-library'),
    path.join(__dirname, '../storage'),
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

