const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const config = require('../config/config');
const AssemblyAIService = require('./assemblyAIService');

const execAsync = promisify(exec);

class SubtitleService {
  static async generateSubtitles(audioPath, outputDir, options = {}) {
    try {
      const { useAssemblyAI = true } = options;
      
      if (useAssemblyAI) {
        console.log('🎯 Using AssemblyAI for transcription...');
        const assemblyAI = new AssemblyAIService();
        const srtPath = await assemblyAI.transcribeAudio(audioPath, outputDir);
        
        if (!srtPath || !fs.existsSync(srtPath)) {
          throw new Error("AssemblyAI subtitle generation failed");
        }
        
        return srtPath;
      } else {
        console.log('🎯 Using local Whisper for transcription...');
        const { generateSubtitlesWithWhisper } = require('./test-whisper');
        const srtPath = await generateSubtitlesWithWhisper(audioPath, outputDir);
        
        if (!srtPath || !fs.existsSync(srtPath)) {
          throw new Error("Whisper subtitle generation failed");
        }
        
        return srtPath;
      }
    } catch (error) {
      console.error("Subtitle generation error:", error);
      throw error;
    }
  }

  static async convertSrtToAss(srtPath, outputDir, fontOptions = {}) {
    try {
      const { convertSrtToAss } = require('../utils/subtitleUtils');
      return await convertSrtToAss(srtPath, outputDir, fontOptions);
    } catch (error) {
      console.error("ASS conversion error:", error);
      return null;
    }
  }

  static async cleanupSubtitleFiles(testOutputDir) {
    try {
      // Remove individual chunk files
      const chunkFiles = await fs.readdir(testOutputDir);
      for (const file of chunkFiles) {
        if (file.startsWith('chunk_') && file.endsWith('.srt')) {
          await fs.remove(path.join(testOutputDir, file));
          console.log(`Removed chunk file: ${file}`);
        }
      }
      
      // Remove chunks directory
      const chunksDir = path.join(testOutputDir, 'chunks');
      if (fs.existsSync(chunksDir)) {
        await fs.remove(chunksDir);
        console.log("Chunks directory cleaned up");
      }
      
      // Remove merged subtitles file
      const mergedSubtitlesPath = path.join(testOutputDir, 'merged_subtitles.srt');
      if (fs.existsSync(mergedSubtitlesPath)) {
        await fs.remove(mergedSubtitlesPath);
        console.log("Merged subtitles file cleaned up");
      }
    } catch (error) {
      console.error("Subtitle cleanup error:", error);
      throw error;
    }
  }
}

module.exports = SubtitleService; 