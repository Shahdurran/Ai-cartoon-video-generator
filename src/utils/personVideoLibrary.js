const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { execSync } = require('child_process');

class PersonVideoLibrary {
  constructor() {
    this.personVideosPath = path.join(process.cwd(), 'person-videos');
    this.thumbnailsPath = path.join(process.cwd(), 'public', 'person-videos', 'thumbnails');
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.supportedFormats = ['.mp4', '.mov', '.webm', '.avi'];
    this.initializeDirectories();
  }

  /**
   * Initialize required directories
   */
  async initializeDirectories() {
    try {
      await fs.ensureDir(this.personVideosPath);
      await fs.ensureDir(this.thumbnailsPath);
      console.log('✅ Person video directories initialized');
    } catch (error) {
      console.error('❌ Error initializing person video directories:', error);
    }
  }

  /**
   * Scan person videos folder and return metadata
   */
  async scanPersonVideos(forceRefresh = false) {
    try {
      const cacheKey = 'scan_all';
      
      // Check cache
      if (!forceRefresh && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          console.log('📦 Returning cached person videos');
          return cached.data;
        }
      }

      console.log('🔍 Scanning person videos folder...');
      
      const files = await fs.readdir(this.personVideosPath);
      const videoFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return this.supportedFormats.includes(ext);
      });

      console.log(`   Found ${videoFiles.length} person video(s)`);

      const videos = [];
      for (const file of videoFiles) {
        try {
          const filePath = path.join(this.personVideosPath, file);
          const metadata = await this.getPersonVideoMetadata(filePath);
          videos.push({
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
        data: videos,
        timestamp: Date.now(),
      });

      return videos;
    } catch (error) {
      console.error('❌ Error scanning person videos:', error);
      return [];
    }
  }

  /**
   * Get metadata for a specific person video
   */
  async getPersonVideoMetadata(filePath) {
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

          const stats = await fs.stat(filePath);
          const filename = path.basename(filePath);
          const ext = path.extname(filename).toLowerCase();

          // Check for alpha channel
          const hasAlpha = await this.checkAlphaChannel(filePath, videoStream);

          // Calculate optimal loop point
          const duration = parseFloat(videoStream.duration || metadata.format.duration || 0);
          const loopQuality = this.assessLoopQuality(duration);

          const metadataObj = {
            duration,
            width: videoStream.width,
            height: videoStream.height,
            codec: videoStream.codec_name,
            fps: this.calculateFPS(videoStream),
            hasAlpha,
            format: ext.replace('.', ''),
            fileSize: stats.size,
            fileSizeFormatted: this.formatFileSize(stats.size),
            aspectRatio: (videoStream.width / videoStream.height).toFixed(2),
            loopQuality,
            thumbnail: await this.getThumbnailPath(filename),
            createdAt: stats.birthtime,
          };

          resolve(metadataObj);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Check if video has alpha channel (transparency)
   */
  async checkAlphaChannel(filePath, videoStream) {
    try {
      // Check pixel format for alpha
      const pixelFormat = videoStream.pix_fmt || '';
      const alphaFormats = ['yuva420p', 'yuva444p', 'rgba', 'argb', 'bgra', 'abgr', 'yuva422p'];
      
      if (alphaFormats.some(fmt => pixelFormat.includes(fmt))) {
        return true;
      }

      // For WebM and MOV, check codec
      if (videoStream.codec_name === 'vp8' || videoStream.codec_name === 'vp9') {
        // VP8/VP9 can have alpha
        return pixelFormat.includes('yuva');
      }

      if (videoStream.codec_name === 'prores') {
        // ProRes 4444 has alpha
        return videoStream.profile === '4' || videoStream.profile === '4444';
      }

      return false;
    } catch (error) {
      console.error('Error checking alpha channel:', error);
      return false;
    }
  }

  /**
   * Assess loop quality based on duration
   */
  assessLoopQuality(duration) {
    if (duration < 1) return 'poor';
    if (duration < 3) return 'fair';
    if (duration < 6) return 'good';
    if (duration < 12) return 'excellent';
    return 'very-long'; // May not loop seamlessly
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
   * Generate thumbnail for person video
   */
  async generatePersonVideoThumbnail(filePath) {
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

        // Generate thumbnail at 1 second mark (or 10% of duration)
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
      return `/person-videos/thumbnails/${thumbnailName}`;
    }
    
    return null;
  }

  /**
   * Validate person video file
   */
  async validatePersonVideo(filePath) {
    try {
      // Check if file exists
      if (!await fs.pathExists(filePath)) {
        return {
          valid: false,
          error: 'File does not exist',
        };
      }

      // Check file size (max 500MB)
      const stats = await fs.stat(filePath);
      if (stats.size > 500 * 1024 * 1024) {
        return {
          valid: false,
          error: 'File size exceeds 500MB limit',
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
      const metadata = await this.getPersonVideoMetadata(filePath);

      // Check duration (should be short for looping)
      if (metadata.duration > 60) {
        console.warn(`⚠️  Video is longer than 60 seconds (${metadata.duration}s). May not loop seamlessly.`);
      }

      // Check resolution (not too large)
      if (metadata.width > 1920 || metadata.height > 1080) {
        console.warn(`⚠️  Video resolution is very high (${metadata.width}x${metadata.height}). May impact performance.`);
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
   * Delete person video and its thumbnail
   */
  async deletePersonVideo(filename) {
    try {
      const filePath = path.join(this.personVideosPath, filename);
      const thumbnailName = filename.replace(/\.[^/.]+$/, '.jpg');
      const thumbnailPath = path.join(this.thumbnailsPath, thumbnailName);

      // Delete video file
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        console.log(`✅ Deleted person video: ${filename}`);
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
      console.error('❌ Error deleting person video:', error);
      throw error;
    }
  }

  /**
   * Get library statistics
   */
  async getStats() {
    try {
      const videos = await this.scanPersonVideos();
      
      const totalSize = videos.reduce((sum, v) => sum + v.fileSize, 0);
      const withAlpha = videos.filter(v => v.hasAlpha).length;
      const formatCounts = {};
      
      videos.forEach(v => {
        formatCounts[v.format] = (formatCounts[v.format] || 0) + 1;
      });

      return {
        totalVideos: videos.length,
        totalSize: this.formatFileSize(totalSize),
        totalSizeBytes: totalSize,
        videosWithAlpha: withAlpha,
        videosWithoutAlpha: videos.length - withAlpha,
        formatBreakdown: formatCounts,
        averageDuration: videos.length > 0 
          ? (videos.reduce((sum, v) => sum + v.duration, 0) / videos.length).toFixed(2)
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
    console.log('🧹 Person video cache cleared');
  }

  /**
   * Get overlay FFmpeg filter for person video
   */
  getOverlayFilter(settings) {
    const {
      position = 'bottom-right',
      scale = 100, // Default to 100% of video height
      opacity = 100,
    } = settings;

    // Calculate scale
    const scaleValue = scale / 100;

    // Position presets
    // For large overlays (scale >= 80%), remove padding to ensure edge alignment
    const usePadding = scale < 80;
    const padding = usePadding ? '10' : '0';
    
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

    const pos = positions[position] || positions['bottom-right'];

    return {
      position: pos,
      scale: scaleValue,
      opacity: opacity / 100,
    };
  }

  /**
   * Apply chroma key (green screen removal)
   */
  getChromaKeyFilter(color = '#00FF00', similarity = 0.3, blend = 0.1) {
    // Convert hex to RGB
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;

    return `chromakey=color=${color}:similarity=${similarity}:blend=${blend}`;
  }

  /**
   * Generate complete FFmpeg overlay filter chain for person video
   * @param {Object} personOverlay - Person overlay configuration
   * @param {number} backgroundDuration - Duration of background video in seconds
   * @param {number} backgroundWidth - Width of background video (default 1920)
   * @param {number} backgroundHeight - Height of background video (default 1080)
   * @param {number} inputIndex - Input index for person video (default 1)
   * @returns {Object} - { filters: string[], inputLabel: string, outputLabel: string }
   */
  generateOverlayFilter(personOverlay, backgroundDuration, backgroundWidth = 1920, backgroundHeight = 1080, inputIndex = 1) {
    const {
      position = 'bottom-right',
      scale = 100, // Default to 100% of video height (full height)
      opacity = 100,
      chromaKey = { enabled: false },
    } = personOverlay;

    const filters = [];
    let currentLabel = `${inputIndex}:v`; // Person video input

    // Step 1: Loop person video to match background duration
    // Using loop filter with proper size parameter
    // size=32767 means loop for up to 32767 frames (will loop indefinitely for our purposes)
    // This ensures the video actually loops instead of showing a static frame
    filters.push(`[${currentLabel}]loop=loop=-1:size=32767[person_loop]`);
    currentLabel = 'person_loop';

    // Step 2: Scale person video to cover full height (100% by default)
    // This will make the person overlay much larger and more prominent
    // The scale parameter represents the percentage of video HEIGHT
    // Width will be adjusted automatically to maintain aspect ratio
    const scalePercent = scale / 100;
    const targetHeight = Math.round(backgroundHeight * scalePercent);
    
    // Use -1 for width to maintain aspect ratio based on the target height
    // With 100% height, this typically results in approximately 50% width coverage
    // for typical person video aspect ratios (9:16 or similar portrait formats)
    filters.push(`[${currentLabel}]scale=-1:${targetHeight}:force_original_aspect_ratio=decrease[person_scaled]`);
    currentLabel = 'person_scaled';

    // Step 3: Apply chroma key if enabled (green screen removal)
    if (chromaKey?.enabled) {
      const similarity = (chromaKey.similarity || 30) / 100;
      const blend = (chromaKey.blend || 10) / 100;
      const color = chromaKey.color || '#00FF00';
      
      // Chromakey filter removes the specified color
      filters.push(`[${currentLabel}]chromakey=${color}:${similarity}:${blend}[person_keyed]`);
      currentLabel = 'person_keyed';
      
      // Convert to format with alpha channel
      filters.push(`[${currentLabel}]format=yuva420p[person_alpha]`);
      currentLabel = 'person_alpha';
    } else if (opacity < 100) {
      // If no chroma key but opacity is set, ensure we have alpha channel
      filters.push(`[${currentLabel}]format=yuva420p[person_alpha]`);
      currentLabel = 'person_alpha';
    }

    // Step 4: Apply opacity if not 100%
    if (opacity < 100) {
      const opacityValue = opacity / 100;
      filters.push(`[${currentLabel}]colorchannelmixer=aa=${opacityValue}[person_opacity]`);
      currentLabel = 'person_opacity';
    }

    // Step 5: Calculate position coordinates
    // For large overlays (scale >= 80%), remove padding to ensure edge alignment
    const usePadding = scale < 80;
    const padding = usePadding ? '10' : '0';
    
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

    const pos = positions[position] || positions['bottom-right'];

    // Return filter chain and position info
    return {
      filters,
      personLabel: currentLabel,
      position: pos,
      backgroundDuration,
    };
  }
}

module.exports = new PersonVideoLibrary();

