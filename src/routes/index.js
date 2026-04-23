/**
 * Main routes index
 * Combines all route modules
 */

const express = require('express');
const router = express.Router();

// Import route modules
const videoRoutes = require('./videoRoutes');
const apiRoutes = require('./apiRoutes');
const cartoonRoutes = require('./cartoonRoutes');

// Mount routes
router.use('/video', videoRoutes);  // Legacy video routes
router.use('/v2', apiRoutes);       // New API v2 routes
// AI Cartoon Generator routes: /api/styles, /api/projects, /api/voices, /api/music, etc.
router.use('/', cartoonRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
  });
});

module.exports = router;

