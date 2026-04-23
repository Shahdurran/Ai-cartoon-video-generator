const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const videoBank = require('../utils/videoBank');
const { paths } = require('../config/paths.config');

class VideoBankController {
  /**
   * Scan video bank and return all videos with metadata
   */
  static async scanVideos(req, res) {
    try {
      console.log('📹 Scanning video bank...');
      
      const cache = await videoBank.cacheVideoList();
      
      // Calculate stats
      const stats = {
        totalVideos: cache.totalCount,
        totalDuration: cache.totalDuration,
        totalSize: cache.totalSize,
        averageDuration: cache.totalCount > 0 ? cache.totalDuration / cache.totalCount : 0,
        cachedAt: cache.cachedAt,
      };

      res.json({
        success: true,
        videos: cache.videos,
        stats,
        message: `Found ${cache.totalCount} videos`,
      });
    } catch (error) {
      console.error('Video bank scan error:', error);
      res.status(500).json({ 
        error: error.message,
        success: false,
      });
    }
  }

  /**
   * Force refresh video bank cache
   */
  static async refreshVideos(req, res) {
    try {
      console.log('🔄 Force refreshing video bank...');
      
      // Clear cache first
      videoBank.clearCache();
      
      // Rebuild cache
      const cache = await videoBank.cacheVideoList(true);
      
      const stats = {
        totalVideos: cache.totalCount,
        totalDuration: cache.totalDuration,
        totalSize: cache.totalSize,
        averageDuration: cache.totalCount > 0 ? cache.totalDuration / cache.totalCount : 0,
        cachedAt: cache.cachedAt,
      };

      res.json({
        success: true,
        videos: cache.videos,
        stats,
        message: `Refreshed: ${cache.totalCount} videos found`,
      });
    } catch (error) {
      console.error('Video bank refresh error:', error);
      res.status(500).json({ 
        error: error.message,
        success: false,
      });
    }
  }

  /**
   * Get video bank statistics
   */
  static async getStats(req, res) {
    try {
      const cache = await videoBank.cacheVideoList();
      
      const stats = {
        totalVideos: cache.totalCount,
        totalDuration: cache.totalDuration,
        totalSize: cache.totalSize,
        averageDuration: cache.totalCount > 0 ? cache.totalDuration / cache.totalCount : 0,
        cachedAt: cache.cachedAt,
        failedCount: cache.failedCount || 0,
      };

      // Additional resolution breakdown
      const resolutions = {};
      cache.videos.forEach(video => {
        if (!resolutions[video.resolution]) {
          resolutions[video.resolution] = 0;
        }
        resolutions[video.resolution]++;
      });

      stats.resolutions = resolutions;

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Video bank stats error:', error);
      res.status(500).json({ 
        error: error.message,
        success: false,
      });
    }
  }

  /**
   * Regenerate thumbnail for a specific video
   */
  static async regenerateThumbnail(req, res) {
    try {
      const { filename } = req.params;
      
      if (!filename) {
        return res.status(400).json({
          error: 'Filename is required',
          success: false,
        });
      }

      const videoPath = path.join(paths.videoBank, filename);
      
      // Check if video exists
      const exists = await fs.pathExists(videoPath);
      if (!exists) {
        return res.status(404).json({
          error: 'Video not found',
          success: false,
        });
      }

      // Generate thumbnail with force flag
      const thumbnailPath = await videoBank.generateThumbnail(videoPath, true);

      res.json({
        success: true,
        thumbnail: thumbnailPath,
        message: `Thumbnail regenerated for ${filename}`,
      });
    } catch (error) {
      console.error('Thumbnail regeneration error:', error);
      res.status(500).json({ 
        error: error.message,
        success: false,
      });
    }
  }

  /**
   * Upload video to video bank
   */
  static async uploadVideo(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No video file provided',
          success: false,
        });
      }

      const file = req.file;
      console.log(`📤 Uploaded video: ${file.filename}`);

      // Get metadata and generate thumbnail
      const videoPath = path.join(paths.videoBank, file.filename);
      const metadata = await videoBank.getVideoMetadata(videoPath, true);

      // Clear cache to include new video
      videoBank.clearCache();

      res.json({
        success: true,
        video: metadata,
        message: `Video "${file.filename}" uploaded successfully`,
      });
    } catch (error) {
      console.error('Video upload error:', error);
      res.status(500).json({ 
        error: error.message,
        success: false,
      });
    }
  }

  /**
   * Delete video from video bank
   */
  static async deleteVideo(req, res) {
    try {
      const { filename } = req.params;
      
      if (!filename) {
        return res.status(400).json({
          error: 'Filename is required',
          success: false,
        });
      }

      const videoPath = path.join(paths.videoBank, filename);
      
      // Check if video exists
      const exists = await fs.pathExists(videoPath);
      if (!exists) {
        return res.status(404).json({
          error: 'Video not found',
          success: false,
        });
      }

      // Delete video file
      await fs.remove(videoPath);

      // Delete thumbnail if exists
      const videoFilename = path.basename(filename, path.extname(filename));
      const thumbnailPath = path.join(videoBank.THUMBNAIL_DIR, `${videoFilename}.jpg`);
      if (await fs.pathExists(thumbnailPath)) {
        await fs.remove(thumbnailPath);
      }

      // Clear cache
      videoBank.clearCache();

      res.json({
        success: true,
        message: `Video "${filename}" deleted successfully`,
      });
    } catch (error) {
      console.error('Video deletion error:', error);
      res.status(500).json({ 
        error: error.message,
        success: false,
      });
    }
  }
}

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, paths.videoBank);
  },
  filename: (req, file, cb) => {
    // Keep original filename but sanitize it
    const sanitized = file.originalname.replace(/[^a-z0-9.-]/gi, '_');
    cb(null, sanitized);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`));
    }
  },
});

module.exports = {
  VideoBankController,
  upload,
};

