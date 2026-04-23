const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config/config');

class AudioService {
  static async getAudioDuration(audioPath) {
    try {
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
          if (err) reject(err);
          else resolve(metadata);
        });
      });

      return parseFloat(metadata.format.duration) || 0;
    } catch (error) {
      console.error("Error getting audio duration:", error);
      return config.VIDEO_CONFIG.MAX_DURATION;
    }
  }

  static async validateAndConvertAudio(audioPath) {
    try {
      console.log("Validating downloaded audio file...");
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found at: ${audioPath}`);
      }

      const audioStats = fs.statSync(audioPath);
      if (audioStats.size === 0) {
        throw new Error("Downloaded audio file is empty");
      }

      // Validate audio format
      await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
          if (err) {
            reject(new Error(`Invalid audio file format: ${err.message}`));
            return;
          }
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
          if (!audioStream) {
            reject(new Error("No audio stream found in file"));
            return;
          }
          resolve(metadata);
        });
      });

      // Convert audio to MP3 format
      const convertedPath = path.join(path.dirname(audioPath), 'converted_audio.mp3');
      await new Promise((resolve, reject) => {
        ffmpeg(audioPath)
          .toFormat('mp3')
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .on('error', (err) => reject(err))
          .save(convertedPath)
          .on('end', resolve);
      });

      // Replace original with converted file
      await fs.remove(audioPath);
      await fs.rename(convertedPath, audioPath);

      return true;
    } catch (error) {
      console.error("Audio processing error:", error);
      throw error;
    }
  }

  /**
   * Mix single background music track with narration
   * @param {string} narrationPath - Path to narration audio
   * @param {string} musicPath - Path to music file
   * @param {object} settings - Music settings (volume, fadeIn, fadeOut, loop)
   * @param {number} targetDuration - Target duration in seconds
   * @param {string} outputPath - Output path for mixed audio
   * @returns {Promise<boolean>}
   */
  static async mixSingleMusicTrack(narrationPath, musicPath, settings, targetDuration, outputPath) {
    try {
      console.log('🎵 Mixing single background music track with narration...');
      console.log(`   Narration: ${path.basename(narrationPath)}`);
      console.log(`   Music: ${path.basename(musicPath)}`);
      console.log(`   Volume: ${settings.volume}%, Fade In: ${settings.fadeIn}s, Fade Out: ${settings.fadeOut}s`);

      // Get music duration
      const musicDuration = await this.getAudioDuration(musicPath);
      
      // Calculate volume (0-100 to 0-1 scale, then reduce further for background)
      const musicVolume = (settings.volume / 100) * 0.3; // Additional 0.3 multiplier to keep music quieter than narration
      
      // Build filter for music
      let musicFilter = `[1:a]volume=${musicVolume}`;
      
      // Add fade in
      if (settings.fadeIn > 0) {
        musicFilter += `,afade=t=in:st=0:d=${settings.fadeIn}`;
      }
      
      // Add fade out
      if (settings.fadeOut > 0) {
        const fadeOutStart = targetDuration - settings.fadeOut;
        musicFilter += `,afade=t=out:st=${fadeOutStart}:d=${settings.fadeOut}`;
      }
      
      musicFilter += '[music]';

      // Build FFmpeg command
      const command = ffmpeg();
      
      // Add narration input
      command.input(narrationPath);
      
      // Add music input with looping if needed
      if (settings.loop && musicDuration < targetDuration) {
        const loopsNeeded = Math.ceil(targetDuration / musicDuration);
        command.input(musicPath).inputOptions(['-stream_loop', (loopsNeeded - 1).toString()]);
      } else {
        command.input(musicPath);
      }
      
      // Apply filters and mix
      command
        .complexFilter([
          musicFilter,
          '[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[final]'
        ])
        .outputOptions([
          '-map', '[final]',
          '-c:a', 'libmp3lame',
          '-b:a', '192k',
          '-t', targetDuration.toString()
        ])
        .output(outputPath);

      await new Promise((resolve, reject) => {
        command
          .on('start', (cmd) => console.log(`   🎵 FFmpeg command: ${cmd.substring(0, 100)}...`))
          .on('error', reject)
          .on('end', () => {
            console.log('   ✅ Audio mixing completed');
            resolve();
          })
          .run();
      });

      return true;
    } catch (error) {
      console.error('❌ Error mixing audio:', error);
      throw error;
    }
  }

  /**
   * Mix multiple music tracks with narration
   * @param {string} narrationPath - Path to narration audio
   * @param {Array} musicTracks - Array of music track configurations
   * @param {number} targetDuration - Target duration in seconds
   * @param {string} outputPath - Output path for mixed audio
   * @returns {Promise<boolean>}
   */
  static async mixMultipleMusicTracks(narrationPath, musicTracks, targetDuration, outputPath) {
    try {
      console.log('🎵 Mixing multiple background music tracks with narration...');
      console.log(`   Narration: ${path.basename(narrationPath)}`);
      console.log(`   Music tracks: ${musicTracks.length}`);

      const command = ffmpeg();
      
      // Add narration input (index 0)
      command.input(narrationPath);
      
      // Add all music inputs and track their durations
      const musicInputs = [];
      for (let i = 0; i < musicTracks.length; i++) {
        const track = musicTracks[i];
        // Construct full path if not provided
        const musicPath = track.music.path || path.join(process.cwd(), 'music-library', track.music.filename);
        
        console.log(`   Track ${i + 1}: ${track.music.title || track.music.filename}`);
        console.log(`      Path: ${musicPath}`);
        console.log(`      Volume: ${track.volume}%, Start: ${track.startTime}s, Fade In/Out: ${track.fadeIn}s/${track.fadeOut}s`);
        
        // Check if music file exists
        const fs = require('fs-extra');
        if (!await fs.pathExists(musicPath)) {
          throw new Error(`Music file not found: ${musicPath}`);
        }
        
        const musicDuration = track.music.duration || await this.getAudioDuration(musicPath);
        
        // Calculate if we need to loop this track
        const trackEndTime = track.startTime + musicDuration;
        const needsLoop = track.loop && trackEndTime < targetDuration;
        
        if (needsLoop) {
          const loopsNeeded = Math.ceil((targetDuration - track.startTime) / musicDuration);
          command.input(musicPath).inputOptions(['-stream_loop', (loopsNeeded - 1).toString()]);
        } else {
          command.input(musicPath);
        }
        
        musicInputs.push({
          index: i + 1, // FFmpeg input index (0 is narration)
          track,
          duration: musicDuration
        });
      }
      
      // Build complex filter
      const filters = [];
      
      // Process each music track
      musicInputs.forEach((input, idx) => {
        const { track } = input;
        const musicVolume = (track.volume / 100) * 0.3; // Keep music quieter than narration
        
        let filter = `[${input.index}:a]`;
        
        // Add delay for start time
        if (track.startTime > 0) {
          filter += `adelay=${track.startTime * 1000}|${track.startTime * 1000}`;
        }
        
        // Add volume
        if (track.startTime > 0) {
          filter += `,volume=${musicVolume}`;
        } else {
          filter += `volume=${musicVolume}`;
        }
        
        // Add fade in
        if (track.fadeIn > 0) {
          const fadeInStart = track.startTime;
          filter += `,afade=t=in:st=${fadeInStart}:d=${track.fadeIn}`;
        }
        
        // Add fade out
        if (track.fadeOut > 0) {
          const fadeOutStart = targetDuration - track.fadeOut;
          filter += `,afade=t=out:st=${fadeOutStart}:d=${track.fadeOut}`;
        }
        
        filter += `[music${idx}]`;
        filters.push(filter);
      });
      
      // Mix all music tracks together
      if (musicTracks.length === 1) {
        filters.push('[music0][0:a]amix=inputs=2:duration=first:dropout_transition=2[final]');
      } else {
        // Mix all music tracks first
        const musicInputLabels = musicInputs.map((_, idx) => `[music${idx}]`).join('');
        filters.push(`${musicInputLabels}amix=inputs=${musicTracks.length}:duration=longest[musicmix]`);
        // Then mix with narration
        filters.push('[musicmix][0:a]amix=inputs=2:duration=first:dropout_transition=2[final]');
      }
      
      command
        .complexFilter(filters)
        .outputOptions([
          '-map', '[final]',
          '-c:a', 'libmp3lame',
          '-b:a', '192k',
          '-t', targetDuration.toString()
        ])
        .output(outputPath);

      await new Promise((resolve, reject) => {
        command
          .on('start', (cmd) => console.log(`   🎵 FFmpeg command: ${cmd.substring(0, 150)}...`))
          .on('error', reject)
          .on('end', () => {
            console.log('   ✅ Multi-track audio mixing completed');
            resolve();
          })
          .run();
      });

      return true;
    } catch (error) {
      console.error('❌ Error mixing multiple music tracks:', error);
      throw error;
    }
  }
}

module.exports = AudioService; 