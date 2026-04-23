const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const config = require('./src/config/config');
const videoRoutes = require('./src/routes/videoRoutes');

const app = express();

// Create necessary directories
fs.ensureDirSync(config.PUBLIC_DIR);
fs.ensureDirSync(config.VIDEOS_DIR);
fs.ensureDirSync(config.EFFECTS_DIR);
fs.ensureDirSync(config.TEMP_DIR);
fs.ensureDirSync(config.TEST_OUTPUT_DIR);

// Middleware
app.use(express.json());

// Static file serving
app.use('/public', express.static(config.PUBLIC_DIR));
app.use('/test-output', express.static(config.TEST_OUTPUT_DIR));

// Routes
app.use('/', videoRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
}); 