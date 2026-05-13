/**
 * API routes for the AI Cartoon Generator (Next.js `web` app).
 */

const express = require('express');
const router = express.Router();

const cartoonRoutes = require('./cartoonRoutes');

router.use('/', cartoonRoutes);

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
  });
});

module.exports = router;
