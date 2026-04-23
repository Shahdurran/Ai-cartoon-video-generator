const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config/config');

/**
 * Get simple font directory path for FFmpeg filters
 * @param {string} fontPath - Path to font file
 * @returns {string} - Simple font directory path
 */
function getFontDir(fontPath) {
  if (!fontPath) return '';
  
  const fontDir = path.dirname(fontPath);
  
  // Make relative to current working directory if it's absolute
  let simplePath;
  if (path.isAbsolute(fontDir)) {
    const relativePath = path.relative(process.cwd(), fontDir);
    simplePath = relativePath || '.';
  } else {
    simplePath = fontDir;
  }
  
  // Convert all backslashes to forward slashes (works on both Windows and Unix)
  simplePath = simplePath.replace(/\\/g, '/');
  
  return simplePath;
}

class VideoService {
  static async getVideoDuration(videoPath) {
    try {
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
          if (err) reject(err);
          else resolve(metadata);
        });
      });

      return parseFloat(metadata.format.duration) || 0;
    } catch (error) {
      console.error("Error getting video duration:", error);
      return 0;
    }
  }

  static async generateVideo({
    imagePath,
    audioPath,
    subtitlePath,
    outputPath,
    useParticleEffect = true,
    particleOpacity = config.VIDEO_CONFIG.DEFAULT_PARTICLE_OPACITY,
    fontOptions = {}
  }) {
    try {
      const duration = await this.getVideoDuration(audioPath);
      const finalDuration = Math.min(duration, config.VIDEO_CONFIG.MAX_DURATION);
      
      let useOverlay = false;
      let overlayDuration = 0;
      
      if (useParticleEffect) {
        const particleEffectPath = path.join(config.EFFECTS_DIR, 'old_camera.mp4');
        if (fs.existsSync(particleEffectPath)) {
          overlayDuration = await this.getVideoDuration(particleEffectPath);
          useOverlay = overlayDuration > 0;
        }
      }

      const videoFilters = this.buildVideoFilters({
        subtitlePath,
        useOverlay,
        particleOpacity,
        fontOptions
      });

      const ffmpegCommand = this.buildFFmpegCommand({
        imagePath,
        audioPath,
        outputPath,
        videoFilters,
        useOverlay,
        overlayDuration,
        finalDuration,
        fontOptions
      });

      await this.executeFFmpegCommand(ffmpegCommand);

      return {
        success: true,
        videoPath: outputPath,
        effectsUsed: {
          particleOverlay: useOverlay,
          subtitles: true
        }
      };
    } catch (error) {
      console.error("Video generation error:", error);
      throw error;
    }
  }

  static buildVideoFilters({ subtitlePath, useOverlay, particleOpacity, fontOptions = {} }) {
    const filters = [];
    
    // Build font style string with Google Fonts support
    const fontStyle = this.buildFontStyle(fontOptions);
    
    if (useOverlay) {
      filters.push('[0:v]scale=1920:1080[bg]');
      filters.push(`[1:v]scale=1920:1080,format=yuva420p,colorchannelmixer=aa=${particleOpacity}[overlay]`);
      filters.push('[bg][overlay]overlay=0:0:shortest=1[blended]');
      
      // Always use subtitles filter for better font control
      console.log(`🎨 Using subtitles filter with font: ${fontOptions.fontFamily || 'default'}`);
      filters.push(`[blended]subtitles='${subtitlePath}':force_style='${fontStyle}'[final]`);
    } else {
      // Always use subtitles filter for better font control
      console.log(`🎨 Using subtitles filter with font: ${fontOptions.fontFamily || 'default'}`);
      filters.push(`subtitles='${subtitlePath}':force_style='${fontStyle}'`);
    }

    return filters;
  }

  /**
   * Build font style string for subtitle rendering
   * @param {Object} fontOptions - Font configuration options
   * @returns {string} - FFmpeg font style string
   */
  static buildFontStyle(fontOptions = {}) {
    const {
      fontFamily = 'Arial',
      fontSize = 18,
      fontColor = '&HFFFFFF',
      outlineColor = '&H80000000',
      backgroundColor = '&H80000000',
      bold = 1,
      italic = 0,
      outline = 2,
      shadow = 1,
      alignment = 2,
      marginV = 30,
      marginL = 10,
      marginR = 10
    } = fontOptions;

    return [
      `FontName=${fontFamily}`,
      `FontSize=${fontSize}`,
      `PrimaryColour=${fontColor}`,
      `OutlineColour=${outlineColor}`,
      `BackColour=${backgroundColor}`,
      `Bold=${bold}`,
      `Italic=${italic}`,
      `Outline=${outline}`,
      `Shadow=${shadow}`,
      `Alignment=${alignment}`,
      `MarginV=${marginV}`,
      `MarginL=${marginL}`,
      `MarginR=${marginR}`
    ].join(',');
  }

  static buildFFmpegCommand({
    imagePath,
    audioPath,
    outputPath,
    videoFilters,
    useOverlay,
    overlayDuration,
    finalDuration,
    fontOptions = {}
  }) {
    const command = ffmpeg()
      .input(imagePath)
      .inputOptions(['-loop', '1']);

    if (useOverlay) {
      const loopsNeeded = Math.ceil(finalDuration / overlayDuration);
      command
        .input(path.join(config.EFFECTS_DIR, 'old_camera.mp4'))
        .inputOptions(['-stream_loop', (loopsNeeded - 1).toString()]);
    }

    command
      .input(audioPath)
      .complexFilter(videoFilters)
      .outputOptions([
        '-map', useOverlay ? '[final]' : '0:v',
        '-map', useOverlay ? '2:a' : '1:a',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        '-t', finalDuration.toString(),
        '-y'
      ])
      .output(outputPath);

    return command;
  }

  static async executeFFmpegCommand(command) {
    return new Promise((resolve, reject) => {
      command
        .on('start', (cmdline) => {
          console.log("FFmpeg command:", cmdline);
        })
        .on('progress', (progress) => {
          console.log("Progress: " + Math.floor(progress.percent) + "%");
        })
        .on('error', (err, stdout, stderr) => {
          console.error("FFmpeg error:", err);
          console.error("FFmpeg stderr:", stderr);
          reject(err);
        })
        .on('end', () => {
          console.log("Video generation completed successfully");
          resolve();
        })
        .run();
    });
  }
}

module.exports = VideoService; 