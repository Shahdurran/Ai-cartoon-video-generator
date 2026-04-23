require('dotenv').config();
const path = require('path');
const fs = require('fs-extra');

/**
 * Path Configuration
 * Centralized management of all file system paths
 */

const projectRoot = path.join(__dirname, '../..');

const paths = {
  // Root project directory
  root: projectRoot,

  // Video bank directory (source videos/assets)
  videoBank: path.join(projectRoot, process.env.VIDEO_BANK_PATH || 'video-bank'),

  // Output directory (final rendered videos)
  output: path.join(projectRoot, process.env.OUTPUT_PATH || 'output'),

  // Temp directory (intermediate processing files)
  temp: path.join(projectRoot, process.env.TEMP_PATH || 'temp'),

  // Storage directory (JSON database files)
  storage: path.join(projectRoot, process.env.STORAGE_PATH || 'storage'),

  // Public directory (static assets)
  public: path.join(projectRoot, 'public'),
  publicVideos: path.join(projectRoot, 'public', 'videos'),
  publicFonts: path.join(projectRoot, 'public', 'fonts'),

  // Test output directory (for testing/development)
  testOutput: path.join(projectRoot, 'test-output'),

  // Effects directory (overlay videos)
  effects: path.join(projectRoot, 'effects'),

  // Storage subdirectories
  channels: path.join(projectRoot, process.env.STORAGE_PATH || 'storage', 'channels'),
  templates: path.join(projectRoot, process.env.STORAGE_PATH || 'storage', 'templates'),
  projects: path.join(projectRoot, process.env.STORAGE_PATH || 'storage', 'projects'),
  batches: path.join(projectRoot, process.env.STORAGE_PATH || 'storage', 'batches'),
};

/**
 * Initialize all required directories
 * Creates directories if they don't exist
 */
async function initializeDirectories() {
  const requiredDirs = [
    paths.videoBank,
    paths.output,
    paths.temp,
    paths.storage,
    paths.publicVideos,
    paths.publicFonts,
    paths.testOutput,
    paths.effects,
    paths.channels,
    paths.templates,
    paths.projects,
    paths.batches,
  ];

  console.log('📁 Initializing directories...');

  for (const dir of requiredDirs) {
    try {
      await fs.ensureDir(dir);
      const relativePath = path.relative(projectRoot, dir);
      console.log(`  ✅ ${relativePath || '.'}`);
    } catch (error) {
      console.error(`  ❌ Failed to create ${dir}:`, error.message);
    }
  }

  console.log('✅ Directory initialization complete!\n');
}

/**
 * Get a temp directory for a specific job
 * @param {string} jobId - Job ID or identifier
 * @returns {string} Path to job-specific temp directory
 */
function getTempDir(jobId) {
  return path.join(paths.temp, `job_${jobId}_${Date.now()}`);
}

/**
 * Get output path for a video
 * @param {string} videoId - Video identifier
 * @param {string} channelId - Optional channel identifier
 * @returns {string} Path to output video file
 */
function getVideoOutputPath(videoId, channelId = null) {
  if (channelId) {
    const channelDir = path.join(paths.output, channelId);
    fs.ensureDirSync(channelDir);
    return path.join(channelDir, `${videoId}.mp4`);
  }
  return path.join(paths.output, `${videoId}.mp4`);
}

/**
 * Get storage path for a specific entity
 * @param {string} type - Entity type (channel, template, project, batch)
 * @param {string} id - Entity ID
 * @returns {string} Path to JSON file
 */
function getStoragePath(type, id) {
  const typeMap = {
    channel: paths.channels,
    template: paths.templates,
    project: paths.projects,
    batch: paths.batches,
  };

  const dir = typeMap[type];
  if (!dir) {
    throw new Error(`Invalid storage type: ${type}`);
  }

  return path.join(dir, `${id}.json`);
}

/**
 * Clean old temp files
 * Removes temp directories older than specified age
 * @param {number} maxAgeMs - Maximum age in milliseconds (default: 24 hours)
 */
async function cleanOldTempFiles(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    console.log('🧹 Cleaning old temp files...');
    
    const files = await fs.readdir(paths.temp);
    const now = Date.now();
    let cleaned = 0;

    for (const file of files) {
      const filePath = path.join(paths.temp, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtimeMs > maxAgeMs) {
        await fs.remove(filePath);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`✅ Cleaned ${cleaned} old temp file(s)`);
    }
  } catch (error) {
    console.error('❌ Error cleaning temp files:', error.message);
  }
}

// Initialize directories on module load
initializeDirectories().catch(error => {
  console.error('❌ Failed to initialize directories:', error);
});

module.exports = {
  paths,
  initializeDirectories,
  getTempDir,
  getVideoOutputPath,
  getStoragePath,
  cleanOldTempFiles,
};

