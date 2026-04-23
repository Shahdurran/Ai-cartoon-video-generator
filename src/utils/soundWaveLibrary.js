const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

class SoundWaveLibrary {
  constructor() {
    this.soundWavesPath = path.join(process.cwd(), 'sound-waves');
    this.thumbnailsPath = path.join(process.cwd(), 'public', 'sound-waves', 'thumbnails');
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.supportedFormats = ['.gif', '.mp4', '.mov', '.webm'];
    this.initializeDirectories();
  }

  /**
   * Initialize required directories
   */
  async initializeDirectories() {
    try {
      await fs.ensureDir(this.soundWavesPath);
      await fs.ensureDir(this.thumbnailsPath);
      console.log('✅ Sound wave directories initialized');
    } catch (error) {
      console.error('❌ Error initializing sound wave directories:', error);
    }
  }

  /**
   * Scan sound waves folder and return metadata
   */
  async scanSoundWaves(forceRefresh = false) {
    try {
      const cacheKey = 'scan_all';
      
      // Check cache
      if (!forceRefresh && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          console.log('📦 Returning cached sound waves');
          return cached.data;
        }
      }

      console.log('🔍 Scanning sound waves folder...');
      
      const files = await fs.readdir(this.soundWavesPath);
      const waveFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return this.supportedFormats.includes(ext);
      });

      console.log(`   Found ${waveFiles.length} sound wave(s)`);

      const waves = [];
      for (const file of waveFiles) {
        try {
          const filePath = path.join(this.soundWavesPath, file);
          const metadata = await this.getSoundWaveMetadata(filePath);
          waves.push({
            filename: file,
            path: filePath,
            ...metadata,
          });
        } catch (error) {
          console.error(`   ⚠️ Error processing ${file}:`, error.message);
        }
      }

      // Cache results
      this.cache.set(cacheKey, {
        data: waves,
        timestamp: Date.now(),
      });

      return waves;
    } catch (error) {
      console.error('❌ Error scanning sound waves:', error);
      return [];
    }
  }

  /**
   * Get metadata for a specific sound wave file
   */
  async getSoundWaveMetadata(filePath) {
    const stats = await fs.stat(filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filename).toLowerCase();

    // For GIF files, use simpler metadata
    if (ext === '.gif') {
      return {
        duration: null, // GIFs loop indefinitely
        width: null,
        height: null,
        codec: 'gif',
        fps: null,
        format: 'gif',
        fileSize: stats.size,
        fileSizeFormatted: this.formatFileSize(stats.size),
        aspectRatio: null,
        thumbnail: await this.getThumbnailPath(filename),
        createdAt: stats.birthtime,
        isGif: true,
      };
    }

    // For video files, get full metadata
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, async (err, metadata) => {
        if (err) {
          return reject(err);
        }

        try {
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          
          if (!videoStream) {
            return reject(new Error('No video stream found'));
          }

          const duration = parseFloat(videoStream.duration || metadata.format.duration || 0);

          const metadataObj = {
            duration,
            width: videoStream.width,
            height: videoStream.height,
            codec: videoStream.codec_name,
            fps: this.calculateFPS(videoStream),
            format: ext.replace('.', ''),
            fileSize: stats.size,
            fileSizeFormatted: this.formatFileSize(stats.size),
            aspectRatio: (videoStream.width / videoStream.height).toFixed(2),
            thumbnail: await this.getThumbnailPath(filename),
            createdAt: stats.birthtime,
            isGif: false,
          };

          resolve(metadataObj);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Calculate FPS from video stream
   */
  calculateFPS(videoStream) {
    if (videoStream.r_frame_rate) {
      const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
      return Math.round(num / den);
    }
    if (videoStream.avg_frame_rate) {
      const [num, den] = videoStream.avg_frame_rate.split('/').map(Number);
      return Math.round(num / den);
    }
    return 30; // Default
  }

  /**
   * Format file size to human readable
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Generate thumbnail for sound wave
   */
  async generateSoundWaveThumbnail(filePath) {
    return new Promise(async (resolve, reject) => {
      try {
        const filename = path.basename(filePath);
        const thumbnailName = filename.replace(/\.[^/.]+$/, '.jpg');
        const thumbnailPath = path.join(this.thumbnailsPath, thumbnailName);

        // Check if thumbnail already exists
        if (await fs.pathExists(thumbnailPath)) {
          console.log(`   ✓ Thumbnail exists: ${thumbnailName}`);
          return resolve(thumbnailPath);
        }

        console.log(`   📸 Generating thumbnail for ${filename}...`);

        const ext = path.extname(filename).toLowerCase();

        // For GIF files, extract first frame
        if (ext === '.gif') {
          ffmpeg(filePath)
            .screenshots({
              timestamps: ['00:00:00.001'],
              filename: thumbnailName,
              folder: this.thumbnailsPath,
              size: '320x240',
            })
            .on('end', () => {
              console.log(`   ✅ Thumbnail generated: ${thumbnailName}`);
              resolve(thumbnailPath);
            })
            .on('error', (err) => {
              console.error(`   ❌ Thumbnail generation error: ${err.message}`);
              reject(err);
            });
        } else {
          // For video files, take screenshot at 10% mark
          ffmpeg(filePath)
            .screenshots({
              timestamps: ['10%'],
              filename: thumbnailName,
              folder: this.thumbnailsPath,
              size: '320x240',
            })
            .on('end', () => {
              console.log(`   ✅ Thumbnail generated: ${thumbnailName}`);
              resolve(thumbnailPath);
            })
            .on('error', (err) => {
              console.error(`   ❌ Thumbnail generation error: ${err.message}`);
              reject(err);
            });
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get thumbnail path (relative to public folder)
   */
  async getThumbnailPath(filename) {
    const thumbnailName = filename.replace(/\.[^/.]+$/, '.jpg');
    const thumbnailPath = path.join(this.thumbnailsPath, thumbnailName);
    
    // Check if exists, if not return placeholder
    if (await fs.pathExists(thumbnailPath)) {
      return `/sound-waves/thumbnails/${thumbnailName}`;
    }
    
    return null;
  }

  /**
   * Validate sound wave file
   */
  async validateSoundWave(filePath) {
    try {
      // Check if file exists
      if (!await fs.pathExists(filePath)) {
        return {
          valid: false,
          error: 'File does not exist',
        };
      }

      // Check file size (max 50MB)
      const stats = await fs.stat(filePath);
      if (stats.size > 50 * 1024 * 1024) {
        return {
          valid: false,
          error: 'File size exceeds 50MB limit',
        };
      }

      // Check format
      const ext = path.extname(filePath).toLowerCase();
      if (!this.supportedFormats.includes(ext)) {
        return {
          valid: false,
          error: `Unsupported format. Supported: ${this.supportedFormats.join(', ')}`,
        };
      }

      // Try to get metadata
      const metadata = await this.getSoundWaveMetadata(filePath);

      // Check duration for video files (should be short for looping)
      if (!metadata.isGif && metadata.duration > 30) {
        console.warn(`⚠️  Video is longer than 30 seconds (${metadata.duration}s). May not loop seamlessly.`);
      }

      return {
        valid: true,
        metadata,
        warnings: [],
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete sound wave and its thumbnail
   */
  async deleteSoundWave(filename) {
    try {
      const filePath = path.join(this.soundWavesPath, filename);
      const thumbnailName = filename.replace(/\.[^/.]+$/, '.jpg');
      const thumbnailPath = path.join(this.thumbnailsPath, thumbnailName);

      // Delete wave file
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        console.log(`✅ Deleted sound wave: ${filename}`);
      }

      // Delete thumbnail
      if (await fs.pathExists(thumbnailPath)) {
        await fs.remove(thumbnailPath);
        console.log(`✅ Deleted thumbnail: ${thumbnailName}`);
      }

      // Clear cache
      this.cache.clear();

      return true;
    } catch (error) {
      console.error('❌ Error deleting sound wave:', error);
      throw error;
    }
  }

  /**
   * Get library statistics
   */
  async getStats() {
    try {
      const waves = await this.scanSoundWaves();
      
      const totalSize = waves.reduce((sum, w) => sum + w.fileSize, 0);
      const formatCounts = {};
      
      waves.forEach(w => {
        formatCounts[w.format] = (formatCounts[w.format] || 0) + 1;
      });

      return {
        totalWaves: waves.length,
        totalSize: this.formatFileSize(totalSize),
        totalSizeBytes: totalSize,
        formatBreakdown: formatCounts,
        gifCount: waves.filter(w => w.isGif).length,
        videoCount: waves.filter(w => !w.isGif).length,
        averageDuration: waves.filter(w => !w.isGif).length > 0
          ? (waves.filter(w => !w.isGif).reduce((sum, w) => sum + (w.duration || 0), 0) / waves.filter(w => !w.isGif).length).toFixed(2)
          : 0,
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Sound wave cache cleared');
  }

  /**
   * Generate complete FFmpeg overlay filter chain for sound wave animation
   * @param {Object} soundWaveOverlay - Sound wave overlay configuration
   * @param {number} backgroundDuration - Duration of background video in seconds
   * @param {number} backgroundWidth - Width of background video (default 1920)
   * @param {number} backgroundHeight - Height of background video (default 1080)
   * @param {number} inputIndex - Input index for sound wave (default 1)
   * @returns {Object} - { filters: string[], waveLabel: string, position: object, backgroundDuration: number }
   */
  generateOverlayFilter(soundWaveOverlay, backgroundDuration, backgroundWidth = 1920, backgroundHeight = 1080, inputIndex = 1) {
    const {
      position = 'bottom-center',
      scale = 30, // Default to 30% of video width
      opacity = 100,
    } = soundWaveOverlay;

    const filters = [];
    let currentLabel = `${inputIndex}:v`; // Sound wave input

    // Step 1: Loop sound wave to match background duration
    // For GIFs and short videos, we need to loop them
    filters.push(`[${currentLabel}]loop=loop=-1:size=32767[wave_loop]`);
    currentLabel = 'wave_loop';

    // Step 2: Scale sound wave based on percentage of video WIDTH
    // This makes sense for horizontal sound waves
    const scalePercent = scale / 100;
    const targetWidth = Math.round(backgroundWidth * scalePercent);
    
    // Use -1 for height to maintain aspect ratio based on the target width
    filters.push(`[${currentLabel}]scale=${targetWidth}:-1:force_original_aspect_ratio=decrease[wave_scaled]`);
    currentLabel = 'wave_scaled';

    // Step 3: Apply opacity if not 100%
    if (opacity < 100) {
      const opacityValue = opacity / 100;
      // Ensure format supports alpha
      filters.push(`[${currentLabel}]format=yuva420p[wave_alpha]`);
      filters.push(`[wave_alpha]colorchannelmixer=aa=${opacityValue}[wave_opacity]`);
      currentLabel = 'wave_opacity';
    }

    // Step 4: Calculate position coordinates
    // Use padding for all positions
    const padding = '20';
    
    const positions = {
      'top-left': { x: padding, y: padding },
      'top-center': { x: '(W-w)/2', y: padding },
      'top-right': { x: `W-w-${padding}`, y: padding },
      'center': { x: '(W-w)/2', y: '(H-h)/2' },
      'center-left': { x: padding, y: '(H-h)/2' },
      'center-right': { x: `W-w-${padding}`, y: '(H-h)/2' },
      'bottom-left': { x: padding, y: `H-h-${padding}` },
      'bottom-center': { x: '(W-w)/2', y: `H-h-${padding}` },
      'bottom-right': { x: `W-w-${padding}`, y: `H-h-${padding}` },
    };

    const pos = positions[position] || positions['bottom-center'];

    // Return filter chain and position info
    return {
      filters,
      waveLabel: currentLabel,
      position: pos,
      backgroundDuration,
    };
  }
}

module.exports = new SoundWaveLibrary();



