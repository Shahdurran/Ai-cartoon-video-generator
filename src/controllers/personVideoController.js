const personVideoLibrary = require('../utils/personVideoLibrary');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Configure multer for person video uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dest = path.join(process.cwd(), 'person-videos');
    await fs.ensureDir(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Sanitize filename
    const sanitized = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_');
    
    // Add timestamp to prevent collisions
    const timestamp = Date.now();
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext);
    cb(null, `${name}_${timestamp}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.mp4', '.mov', '.webm', '.avi'];
    
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowed.join(', ')}`));
    }
  },
});

class PersonVideoController {
  /**
   * Scan and list all person videos
   */
  static async scanPersonVideos(req, res) {
    try {
      const { forceRefresh } = req.query;
      const videos = await personVideoLibrary.scanPersonVideos(forceRefresh === 'true');

      res.json({
        success: true,
        videos,
        count: videos.length,
      });
    } catch (error) {
      console.error('Scan person videos error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Get library statistics
   */
  static async getStats(req, res) {
    try {
      const stats = await personVideoLibrary.getStats();

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Upload person video
   */
  static async uploadPersonVideo(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'No file uploaded' 
        });
      }

      console.log(`📤 Person video uploaded: ${req.file.filename}`);

      // Validate the uploaded video
      const validation = await personVideoLibrary.validatePersonVideo(req.file.path);
      
      if (!validation.valid) {
        // Delete invalid file
        await fs.remove(req.file.path);
        return res.status(400).json({
          success: false,
          error: validation.error,
        });
      }

      // Generate thumbnail
      try {
        await personVideoLibrary.generatePersonVideoThumbnail(req.file.path);
      } catch (err) {
        console.warn('⚠️  Could not generate thumbnail:', err.message);
      }

      // Clear cache
      personVideoLibrary.clearCache();

      res.json({
        success: true,
        message: 'Person video uploaded successfully',
        file: {
          filename: req.file.filename,
          path: req.file.path,
          size: req.file.size,
          ...validation.metadata,
        },
      });
    } catch (error) {
      console.error('Upload person video error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Delete person video
   */
  static async deletePersonVideo(req, res) {
    try {
      const { filename } = req.params;

      if (!filename) {
        return res.status(400).json({ 
          success: false,
          error: 'Filename is required' 
        });
      }

      await personVideoLibrary.deletePersonVideo(filename);

      res.json({
        success: true,
        message: 'Person video deleted successfully',
        filename,
      });
    } catch (error) {
      console.error('Delete person video error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Regenerate thumbnail for person video
   */
  static async regenerateThumbnail(req, res) {
    try {
      const { filename } = req.params;

      if (!filename) {
        return res.status(400).json({ 
          success: false,
          error: 'Filename is required' 
        });
      }

      const filePath = path.join(process.cwd(), 'person-videos', filename);

      if (!await fs.pathExists(filePath)) {
        return res.status(404).json({ 
          success: false,
          error: 'Video file not found' 
        });
      }

      // Delete old thumbnail
      const thumbnailName = filename.replace(/\.[^/.]+$/, '.jpg');
      const thumbnailPath = path.join(process.cwd(), 'public', 'person-videos', 'thumbnails', thumbnailName);
      
      if (await fs.pathExists(thumbnailPath)) {
        await fs.remove(thumbnailPath);
      }

      // Generate new thumbnail
      const newThumbnailPath = await personVideoLibrary.generatePersonVideoThumbnail(filePath);

      // Clear cache
      personVideoLibrary.clearCache();

      res.json({
        success: true,
        message: 'Thumbnail regenerated successfully',
        thumbnailPath: `/person-videos/thumbnails/${thumbnailName}`,
      });
    } catch (error) {
      console.error('Regenerate thumbnail error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Refresh cache
   */
  static async refreshCache(req, res) {
    try {
      personVideoLibrary.clearCache();
      const videos = await personVideoLibrary.scanPersonVideos(true);

      res.json({
        success: true,
        message: 'Cache refreshed successfully',
        videos,
        count: videos.length,
      });
    } catch (error) {
      console.error('Refresh cache error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Get metadata for specific person video
   */
  static async getPersonVideoInfo(req, res) {
    try {
      const { filename } = req.params;

      if (!filename) {
        return res.status(400).json({ 
          success: false,
          error: 'Filename is required' 
        });
      }

      const filePath = path.join(process.cwd(), 'person-videos', filename);

      if (!await fs.pathExists(filePath)) {
        return res.status(404).json({ 
          success: false,
          error: 'Video file not found' 
        });
      }

      const metadata = await personVideoLibrary.getPersonVideoMetadata(filePath);

      res.json({
        success: true,
        filename,
        metadata,
      });
    } catch (error) {
      console.error('Get person video info error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }
}

module.exports = { PersonVideoController, upload };

