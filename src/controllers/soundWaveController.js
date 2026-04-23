const soundWaveLibrary = require('../utils/soundWaveLibrary');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Configure multer for sound wave uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dest = path.join(process.cwd(), 'sound-waves');
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
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.gif', '.mp4', '.mov', '.webm'];
    
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowed.join(', ')}`));
    }
  },
});

class SoundWaveController {
  /**
   * Scan and list all sound waves
   */
  static async scanSoundWaves(req, res) {
    try {
      const { forceRefresh } = req.query;
      const waves = await soundWaveLibrary.scanSoundWaves(forceRefresh === 'true');

      res.json({
        success: true,
        waves,
        count: waves.length,
      });
    } catch (error) {
      console.error('Scan sound waves error:', error);
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
      const stats = await soundWaveLibrary.getStats();

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
   * Upload sound wave
   */
  static async uploadSoundWave(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'No file uploaded' 
        });
      }

      console.log(`📤 Sound wave uploaded: ${req.file.filename}`);

      // Validate the uploaded file
      const validation = await soundWaveLibrary.validateSoundWave(req.file.path);
      
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
        await soundWaveLibrary.generateSoundWaveThumbnail(req.file.path);
      } catch (err) {
        console.warn('⚠️  Could not generate thumbnail:', err.message);
      }

      // Clear cache
      soundWaveLibrary.clearCache();

      res.json({
        success: true,
        message: 'Sound wave uploaded successfully',
        file: {
          filename: req.file.filename,
          path: req.file.path,
          size: req.file.size,
          ...validation.metadata,
        },
      });
    } catch (error) {
      console.error('Upload sound wave error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Delete sound wave
   */
  static async deleteSoundWave(req, res) {
    try {
      const { filename } = req.params;

      if (!filename) {
        return res.status(400).json({ 
          success: false,
          error: 'Filename is required' 
        });
      }

      await soundWaveLibrary.deleteSoundWave(filename);

      res.json({
        success: true,
        message: 'Sound wave deleted successfully',
        filename,
      });
    } catch (error) {
      console.error('Delete sound wave error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Regenerate thumbnail for sound wave
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

      const filePath = path.join(process.cwd(), 'sound-waves', filename);

      if (!await fs.pathExists(filePath)) {
        return res.status(404).json({ 
          success: false,
          error: 'Sound wave file not found' 
        });
      }

      // Delete old thumbnail
      const thumbnailName = filename.replace(/\.[^/.]+$/, '.jpg');
      const thumbnailPath = path.join(process.cwd(), 'public', 'sound-waves', 'thumbnails', thumbnailName);
      
      if (await fs.pathExists(thumbnailPath)) {
        await fs.remove(thumbnailPath);
      }

      // Generate new thumbnail
      const newThumbnailPath = await soundWaveLibrary.generateSoundWaveThumbnail(filePath);

      // Clear cache
      soundWaveLibrary.clearCache();

      res.json({
        success: true,
        message: 'Thumbnail regenerated successfully',
        thumbnailPath: `/sound-waves/thumbnails/${thumbnailName}`,
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
      soundWaveLibrary.clearCache();
      const waves = await soundWaveLibrary.scanSoundWaves(true);

      res.json({
        success: true,
        message: 'Cache refreshed successfully',
        waves,
        count: waves.length,
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
   * Get metadata for specific sound wave
   */
  static async getSoundWaveInfo(req, res) {
    try {
      const { filename } = req.params;

      if (!filename) {
        return res.status(400).json({ 
          success: false,
          error: 'Filename is required' 
        });
      }

      const filePath = path.join(process.cwd(), 'sound-waves', filename);

      if (!await fs.pathExists(filePath)) {
        return res.status(404).json({ 
          success: false,
          error: 'Sound wave file not found' 
        });
      }

      const metadata = await soundWaveLibrary.getSoundWaveMetadata(filePath);

      res.json({
        success: true,
        filename,
        metadata,
      });
    } catch (error) {
      console.error('Get sound wave info error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }
}

module.exports = { SoundWaveController, upload };



