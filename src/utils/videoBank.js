const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { paths } = require('../config/paths.config');

// Cache for video metadata
let videoCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Thumbnail configuration
const THUMBNAIL_DIR = path.join(process.cwd(), 'public', 'thumbnails');
const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 180;
const THUMBNAIL_TIMESTAMP = 1; // Extract frame at 1 second

/**
 * Scan video bank directory for all video files
 * @param {string} folderPath - Path to video bank folder (optional, defaults to config)
 * @returns {Promise<Array>} Array of video file paths
 */
async function scanVideoBank(folderPath = null) {
  const bankPath = folderPath || paths.videoBank;
  
  console.log(`📁 Scanning video bank: ${bankPath}`);

  try {
    // Check if directory exists
    const exists = await fs.pathExists(bankPath);
    if (!exists) {
      console.warn(`⚠️  Video bank directory doesn't exist: ${bankPath}`);
      await fs.ensureDir(bankPath);
      return [];
    }

    // Read all files
    const files = await fs.readdir(bankPath);
    
    // Filter for video files
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv'];
    const videoFiles = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return videoExtensions.includes(ext);
      })
      .map(file => path.join(bankPath, file));

    console.log(`   ✅ Found ${videoFiles.length} video files`);
    
    return videoFiles;
  } catch (error) {
    console.error(`❌ Error scanning video bank:`, error.message);
    return [];
  }
}

/**
 * Ensure thumbnail directory exists
 */
async function ensureThumbnailDir() {
  await fs.ensureDir(THUMBNAIL_DIR);
}

/**
 * Generate thumbnail for a video
 * @param {string} videoPath - Path to video file
 * @param {boolean} force - Force regenerate even if exists
 * @returns {Promise<string>} Path to thumbnail (relative to public)
 */
async function generateThumbnail(videoPath, force = false) {
  await ensureThumbnailDir();
  
  const videoFilename = path.basename(videoPath, path.extname(videoPath));
  const thumbnailFilename = `${videoFilename}.jpg`;
  const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFilename);
  const relativePath = `/thumbnails/${thumbnailFilename}`;
  
  // Check if thumbnail already exists
  if (!force && await fs.pathExists(thumbnailPath)) {
    return relativePath;
  }
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: [THUMBNAIL_TIMESTAMP],
        filename: thumbnailFilename,
        folder: THUMBNAIL_DIR,
        size: `${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}`,
      })
      .on('end', () => {
        resolve(relativePath);
      })
      .on('error', (err) => {
        console.error(`Failed to generate thumbnail for ${videoFilename}:`, err.message);
        reject(err);
      });
  });
}

/**
 * Get video metadata using ffprobe
 * @param {string} videoPath - Path to video file
 * @param {boolean} generateThumb - Whether to generate thumbnail
 * @returns {Promise<Object>} Video metadata
 */
async function getVideoMetadata(videoPath, generateThumb = true) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, async (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const duration = parseFloat(metadata.format.duration) || 0;
        const width = videoStream ? videoStream.width : 0;
        const height = videoStream ? videoStream.height : 0;
        const resolution = `${width}x${height}`;
        const fps = videoStream ? eval(videoStream.r_frame_rate) : 0;
        const fileStats = await fs.stat(videoPath);

        const result = {
          path: videoPath,
          filename: path.basename(videoPath),
          duration,
          resolution,
          width,
          height,
          fps,
          size: metadata.format.size || fileStats.size || 0,
          bitrate: metadata.format.bit_rate || 0,
          addedAt: fileStats.birthtime || fileStats.mtime,
          thumbnail: null,
        };

        // Generate thumbnail if requested
        if (generateThumb) {
          try {
            result.thumbnail = await generateThumbnail(videoPath);
          } catch (thumbError) {
            console.warn(`Could not generate thumbnail for ${result.filename}`);
            result.thumbnail = null;
          }
        }

        resolve(result);
      } catch (parseError) {
        reject(new Error(`Failed to parse metadata for ${videoPath}: ${parseError.message}`));
      }
    });
  });
}

/**
 * Cache video list with metadata
 * @param {boolean} forceRefresh - Force refresh cache even if not expired
 * @returns {Promise<Object>} Cached video data
 */
async function cacheVideoList(forceRefresh = false) {
  const now = Date.now();

  // Return cached data if available and not expired
  if (!forceRefresh && videoCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    console.log(`📦 Using cached video list (age: ${Math.round((now - cacheTimestamp) / 1000)}s)`);
    return videoCache;
  }

  console.log(`🔄 Refreshing video bank cache...`);

  // Scan for videos
  const videoFiles = await scanVideoBank();

  if (videoFiles.length === 0) {
    videoCache = {
      videos: [],
      totalDuration: 0,
      totalCount: 0,
      totalSize: 0,
      cachedAt: new Date().toISOString(),
    };
    cacheTimestamp = now;
    return videoCache;
  }

  // Get metadata for all videos (with progress)
  console.log(`📊 Analyzing ${videoFiles.length} videos...`);
  const videos = [];
  let failedCount = 0;

  for (let i = 0; i < videoFiles.length; i++) {
    const videoPath = videoFiles[i];
    try {
      const metadata = await getVideoMetadata(videoPath);
      videos.push(metadata);
      
      if ((i + 1) % 5 === 0 || i === videoFiles.length - 1) {
        console.log(`   📹 Processed ${i + 1}/${videoFiles.length} videos...`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to get metadata for ${path.basename(videoPath)}:`, error.message);
      failedCount++;
    }
  }

  // Calculate totals
  const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);
  const totalSize = videos.reduce((sum, v) => sum + v.size, 0);

  videoCache = {
    videos,
    totalDuration,
    totalCount: videos.length,
    totalSize,
    failedCount,
    cachedAt: new Date().toISOString(),
  };
  cacheTimestamp = now;

  console.log(`✅ Video bank cache updated:`);
  console.log(`   📹 ${videos.length} videos`);
  console.log(`   ⏱️  ${Math.round(totalDuration)}s total duration`);
  console.log(`   💾 ${(totalSize / (1024 * 1024)).toFixed(2)} MB total size`);
  if (failedCount > 0) {
    console.log(`   ⚠️  ${failedCount} videos failed to analyze`);
  }

  return videoCache;
}

/**
 * Select videos for rotation based on required duration
 * Smart selection that tries to minimize repetition and matches duration
 * @param {number} count - Number of video segments needed
 * @param {number} targetDuration - Target duration for each segment in seconds
 * @returns {Promise<Array>} Array of selected video metadata
 */
async function selectVideosForRotation(count, targetDuration) {
  console.log(`\n🎲 Selecting ${count} videos for rotation (${targetDuration}s each)`);

  // Get cached video list
  const cache = await cacheVideoList();
  
  if (cache.videos.length === 0) {
    throw new Error('No videos available in video bank');
  }

  const selectedVideos = [];

  // Sort videos by how close they are to target duration
  const sortedVideos = [...cache.videos].sort((a, b) => {
    const diffA = Math.abs(a.duration - targetDuration);
    const diffB = Math.abs(b.duration - targetDuration);
    return diffA - diffB;
  });

  // If we need more segments than available videos, we'll repeat
  const needsRepetition = count > cache.videos.length;
  
  if (needsRepetition) {
    console.log(`   ⚠️  Need ${count} segments but only ${cache.videos.length} videos available - will repeat`);
  }

  // Select videos with smart rotation
  for (let i = 0; i < count; i++) {
    // Use modulo to cycle through videos if needed
    const videoIndex = i % sortedVideos.length;
    selectedVideos.push({
      ...sortedVideos[videoIndex],
      segmentIndex: i,
      targetDuration,
    });
  }

  console.log(`   ✅ Selected ${selectedVideos.length} video segments:`);
  selectedVideos.forEach((v, i) => {
    if (i < 3 || i >= selectedVideos.length - 1) {
      console.log(`      ${i + 1}. ${v.filename} (${v.duration.toFixed(1)}s)`);
    } else if (i === 3) {
      console.log(`      ... (${selectedVideos.length - 4} more) ...`);
    }
  });

  return selectedVideos;
}

/**
 * Get a random video from the bank
 * @returns {Promise<Object>} Random video metadata
 */
async function getRandomVideo() {
  const cache = await cacheVideoList();
  
  if (cache.videos.length === 0) {
    throw new Error('No videos available in video bank');
  }

  const randomIndex = Math.floor(Math.random() * cache.videos.length);
  return cache.videos[randomIndex];
}

/**
 * Get videos that match specific criteria
 * @param {Object} criteria - Filter criteria
 * @param {number} criteria.minDuration - Minimum duration in seconds
 * @param {number} criteria.maxDuration - Maximum duration in seconds
 * @param {string} criteria.resolution - Exact resolution (e.g., '1920x1080')
 * @returns {Promise<Array>} Filtered video list
 */
async function getVideosByCriteria(criteria = {}) {
  const cache = await cacheVideoList();
  let filtered = [...cache.videos];

  if (criteria.minDuration !== undefined) {
    filtered = filtered.filter(v => v.duration >= criteria.minDuration);
  }

  if (criteria.maxDuration !== undefined) {
    filtered = filtered.filter(v => v.duration <= criteria.maxDuration);
  }

  if (criteria.resolution) {
    filtered = filtered.filter(v => v.resolution === criteria.resolution);
  }

  console.log(`🔍 Filtered videos: ${filtered.length}/${cache.videos.length} match criteria`);
  return filtered;
}

/**
 * Clear the video cache (useful for testing or after adding new videos)
 */
function clearCache() {
  videoCache = null;
  cacheTimestamp = null;
  console.log('🗑️  Video cache cleared');
}

module.exports = {
  scanVideoBank,
  getVideoMetadata,
  cacheVideoList,
  selectVideosForRotation,
  getRandomVideo,
  getVideosByCriteria,
  clearCache,
  generateThumbnail,
  ensureThumbnailDir,
  THUMBNAIL_DIR,
};


