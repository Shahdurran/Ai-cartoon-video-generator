const path = require('path');
const fs = require('fs-extra');
const { paths } = require('../config/paths.config');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Mock Voice Service
 * Generates silent audio files for testing when real TTS is not available
 * This allows the pipeline to work end-to-end while TTS issues are being resolved
 */
class MockVoiceService {
  /**
   * Generate a mock voice file (silent audio)
   * @param {string} text - Text that would be converted to speech
   * @param {object} options - Voice options
   * @returns {Promise<object>} Mock audio file info
   */
  async generateVoice(text, options = {}) {
    console.log('   🔇 Using Mock Voice Service (generating silent audio for testing)...');
    console.log(`   📝 Text length: ${text.length} characters`);

    // Estimate duration based on text length (average reading speed: ~150 words/min = 2.5 words/sec)
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = Math.max(2, Math.ceil(wordCount / 2.5)); // At least 2 seconds

    const outputPath = path.join(paths.temp, `mock_voice_${Date.now()}.mp3`);

    try {
      // Generate silent audio using FFmpeg
      const ffmpegCmd = `ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t ${estimatedDuration} -q:a 9 -acodec libmp3lame "${outputPath}" -y`;
      
      await execPromise(ffmpegCmd);

      const stats = await fs.stat(outputPath);

      console.log(`   ✅ Mock audio generated: ${estimatedDuration}s silent MP3`);
      console.log(`   📁 Saved to: ${outputPath}`);

      return {
        success: true,
        audioPath: outputPath,
        duration: estimatedDuration,
        provider: 'mock',
        format: 'mp3',
        metadata: {
          textLength: text.length,
          wordCount,
          estimatedDuration,
          fileSize: stats.size,
          isMock: true,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('❌ Failed to generate mock audio:', error.message);
      throw new Error(`Mock voice generation failed: ${error.message}`);
    }
  }
}

module.exports = MockVoiceService;

