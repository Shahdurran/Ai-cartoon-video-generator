const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const musicLibrary = require('../utils/musicLibrary');

class MusicLibraryController {
  /**
   * Scan music library and return all music with metadata
   */
  static async scanMusic(req, res) {
    try {
      console.log('🎵 Scanning music library...');
      
      const cache = await musicLibrary.cacheMusicList();
      
      // Calculate stats
      const stats = {
        totalMusic: cache.totalCount,
        totalDuration: cache.totalDuration,
        totalSize: cache.totalSize,
        averageDuration: cache.totalCount > 0 ? cache.totalDuration / cache.totalCount : 0,
        cachedAt: cache.cachedAt,
      };

      res.json({
        success: true,
        music: cache.music,
        stats,
        message: `Found ${cache.totalCount} music files`,
      });
    } catch (error) {
      console.error('Music library scan error:', error);
      res.status(500).json({ 
        error: error.message,
        success: false,
      });
    }
  }

  /**
   * Force refresh music library cache
   */
  static async refreshMusic(req, res) {
    try {
      console.log('🔄 Force refreshing music library...');
      
      // Clear cache first
      musicLibrary.clearCache();
      
      // Rebuild cache
      const cache = await musicLibrary.cacheMusicList(true);
      
      const stats = {
        totalMusic: cache.totalCount,
        totalDuration: cache.totalDuration,
        totalSize: cache.totalSize,
        averageDuration: cache.totalCount > 0 ? cache.totalDuration / cache.totalCount : 0,
        cachedAt: cache.cachedAt,
      };

      res.json({
        success: true,
        music: cache.music,
        stats,
        message: `Refreshed: ${cache.totalCount} music files found`,
      });
    } catch (error) {
      console.error('Music library refresh error:', error);
      res.status(500).json({ 
        error: error.message,
        success: false,
      });
    }
  }

  /**
   * Get music library statistics
   */
  static async getStats(req, res) {
    try {
      const cache = await musicLibrary.cacheMusicList();
      
      const stats = {
        totalMusic: cache.totalCount,
        totalDuration: cache.totalDuration,
        totalSize: cache.totalSize,
        averageDuration: cache.totalCount > 0 ? cache.totalDuration / cache.totalCount : 0,
        cachedAt: cache.cachedAt,
        failedCount: cache.failedCount || 0,
      };

      // Additional format breakdown
      const formats = {};
      cache.music.forEach(music => {
        if (!formats[music.format]) {
          formats[music.format] = 0;
        }
        formats[music.format]++;
      });

      stats.formats = formats;

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Music library stats error:', error);
      res.status(500).json({ 
        error: error.message,
        success: false,
      });
    }
  }

  /**
   * Upload music to library
   */
  static async uploadMusic(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No music file provided',
          success: false,
        });
      }

      const file = req.file;
      console.log(`📤 Uploaded music: ${file.filename}`);

      // Validate that it's actually an audio file
      const musicPath = path.join(musicLibrary.MUSIC_LIBRARY_PATH, file.filename);
      const isValid = await musicLibrary.validateAudioFile(musicPath);
      
      if (!isValid) {
        // Delete invalid file
        await fs.remove(musicPath);
        return res.status(400).json({
          error: 'Invalid audio file',
          success: false,
        });
      }

      // Get metadata
      const metadata = await musicLibrary.getMusicMetadata(musicPath);

      // Clear cache to include new music
      musicLibrary.clearCache();

      res.json({
        success: true,
        music: metadata,
        message: `Music "${file.filename}" uploaded successfully`,
      });
    } catch (error) {
      console.error('Music upload error:', error);
      res.status(500).json({ 
        error: error.message,
        success: false,
      });
    }
  }

  /**
   * Delete music from library
   */
  static async deleteMusic(req, res) {
    try {
      const { filename } = req.params;
      
      if (!filename) {
        return res.status(400).json({
          error: 'Filename is required',
          success: false,
        });
      }

      const musicPath = path.join(musicLibrary.MUSIC_LIBRARY_PATH, filename);
      
      // Check if music exists
      const exists = await fs.pathExists(musicPath);
      if (!exists) {
        return res.status(404).json({
          error: 'Music file not found',
          success: false,
        });
      }

      // Delete music file
      await fs.remove(musicPath);

      // Clear cache
      musicLibrary.clearCache();

      res.json({
        success: true,
        message: `Music "${filename}" deleted successfully`,
      });
    } catch (error) {
      console.error('Music deletion error:', error);
      res.status(500).json({ 
        error: error.message,
        success: false,
      });
    }
  }

  /**
   * Get specific music file info
   */
  static async getMusicInfo(req, res) {
    try {
      const { filename } = req.params;
      
      if (!filename) {
        return res.status(400).json({
          error: 'Filename is required',
          success: false,
        });
      }

      const music = await musicLibrary.getMusicByFilename(filename);
      
      if (!music) {
        return res.status(404).json({
          error: 'Music file not found',
          success: false,
        });
      }

      res.json({
        success: true,
        music,
      });
    } catch (error) {
      console.error('Get music info error:', error);
      res.status(500).json({ 
        error: error.message,
        success: false,
      });
    }
  }
}

// Configure multer for music uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, musicLibrary.MUSIC_LIBRARY_PATH);
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
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`));
    }
  },
});

module.exports = {
  MusicLibraryController,
  upload,
};

