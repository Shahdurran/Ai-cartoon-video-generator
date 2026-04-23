const fs = require('fs-extra');
const path = require('path');
const config = require('../config/config');
const AudioService = require('../services/audioService');
const SubtitleService = require('../services/subtitleService');
const VideoService = require('../services/videoService');
const GoogleFontsService = require('../services/googleFontsService');
const downloadFile = require('../utils/downloadFile');

class VideoController {
  static async generateVideo(req, res) {
    const { 
      audioUrl, 
      imageUrl, 
      useParticleEffect = true, 
      particleOpacity = config.VIDEO_CONFIG.DEFAULT_PARTICLE_OPACITY,
      useAssemblyAI = true,
      fontOptions = {}
    } = req.body;

    if (!audioUrl || !imageUrl) {
      return res.status(400).json({ error: "audioUrl and imageUrl are required" });
    }

    const tempDir = path.join(config.TEMP_DIR, `${Date.now()}`);
    await fs.ensureDir(tempDir);

    try {
      // Step 1: Download files
      const audioPath = path.join(tempDir, "audio.mp3");
      const imagePath = path.join(tempDir, "background.jpg");

      try {
        await Promise.all([
          downloadFile(audioUrl, audioPath),
          downloadFile(imageUrl, imagePath)
        ]);
      } catch (downloadError) {
        throw new Error(`Download failed: ${downloadError.message}`);
      }

      // Step 2: Process audio
      await AudioService.validateAndConvertAudio(audioPath);

      // Step 3: Prepare font for subtitles
      const googleFonts = new GoogleFontsService();
      await googleFonts.initializeFonts();
      
      let processedFontOptions = { ...fontOptions };
      if (fontOptions.fontFamily) {
        const fontConfig = await googleFonts.prepareFontForSubtitles(fontOptions.fontFamily);
        processedFontOptions.fontFamily = fontConfig.fontFamily;
        if (fontConfig.fontPath) {
          processedFontOptions.fontPath = fontConfig.fontPath;
        }
      }

      // Step 4: Generate subtitles
      const srtPath = await SubtitleService.generateSubtitles(audioPath, tempDir, { useAssemblyAI });
      
      // Step 5: Convert subtitles to ASS format
      const assPath = await SubtitleService.convertSrtToAss(srtPath, tempDir, processedFontOptions);
      const finalSubtitlePath = assPath || srtPath;

      // Step 6: Generate video
      const videoFileName = `video_${Date.now()}.mp4`;
      const videoPath = path.join(config.TEST_OUTPUT_DIR, videoFileName);

      const result = await VideoService.generateVideo({
        imagePath,
        audioPath,
        subtitlePath: finalSubtitlePath,
        outputPath: videoPath,
        useParticleEffect,
        particleOpacity,
        fontOptions: processedFontOptions
      });

      // Step 7: Clean up
      await fs.remove(tempDir);
      await SubtitleService.cleanupSubtitleFiles(config.TEST_OUTPUT_DIR);

      // Return success response
      const videoUrl = `http://localhost:${config.PORT}/test-output/${videoFileName}`;
      res.json({
        videoUrl,
        effectsUsed: result.effectsUsed,
        transcriptionMethod: useAssemblyAI ? 'AssemblyAI' : 'Local Whisper',
        fontUsed: processedFontOptions.fontFamily || 'Arial'
      });

    } catch (error) {
      console.error("Video generation error:", error);
      await fs.remove(tempDir).catch(console.error);
      res.status(500).json({ error: "Video generation failed: " + error.message });
    }
  }
}

module.exports = VideoController; 