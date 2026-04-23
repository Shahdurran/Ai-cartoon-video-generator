const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const apiConfig = require('../config/api.config');
const { paths } = require('../config/paths.config');

class VoiceService {
  constructor() {
    this.genaiproConfig = apiConfig.genaipro;
    this.falAIConfig = apiConfig.falAI;
  }

  /**
   * Generate voice audio from text
   * @param {string} script - Text to convert to speech
   * @param {object} options - Voice options
   * @param {string} options.voice - Voice model to use
   * @param {string} options.voiceCloneId - Voice clone ID (for genAi pro cloned voices)
   * @param {number} options.speed - Speech speed (0.25 to 4.0)
   * @param {string} options.provider - 'genaipro', 'fal', or 'auto' (auto = try primary, fallback to secondary)
   * @returns {Promise<object>} Audio file path, duration, provider, and format
   */
  async generateVoice(script, options = {}) {
    const {
      voice = null, // Will fall back to defaultVoiceId if null
      voiceCloneId = null, // Voice clone ID for genAi pro
      speed = this.genaiproConfig.defaultSpeed,
      provider = 'auto',
      language = 'Auto', // Language for voice generation
      outputPath = null,
    } = options;

    console.log(`🎙️  Generating voice: ${script.substring(0, 50)}...`);
    console.log(`   Voice: ${voice}, Voice Clone ID: ${voiceCloneId || 'none'}, Speed: ${speed}, Provider: ${provider}, Language: ${language}`);
    console.log(`   Full options received:`, JSON.stringify(options, null, 2));

    try {
      let result;

      if (provider === 'genaipro') {
        result = await this._generateWithGenaipro(script, voice, speed, outputPath, voiceCloneId, language);
      } else if (provider === 'fal') {
        result = await this._generateWithFalAI(script, voice, speed, outputPath);
      } else {
        // Auto mode: use Genaipro only (fallback disabled to prevent errors)
        result = await this._generateWithGenaipro(script, voice, speed, outputPath, voiceCloneId, language);
      }

      // Get audio duration
      const duration = await this._getAudioDuration(result.audioPath);
      result.duration = duration;

      return result;
    } catch (error) {
      console.error('❌ Voice generation failed:', error.message);
      throw new Error(`Voice generation failed: ${error.message}`);
    }
  }

  /**
   * Generate voice using Genaipro.vn API (Primary) - Task-based API
   * @private
   */
  async _generateWithGenaipro(script, voice, speed, outputPath, voiceCloneId = null, language = 'Auto') {
    if (!this.genaiproConfig.apiKey) {
      throw new Error('GENAIPRO_API_KEY not configured');
    }

    console.log('   🌐 Using Genaipro.vn (task-based API)...');
    if (voiceCloneId) {
      console.log(`   🎭 Using voice clone: ${voiceCloneId}`);
    }
    console.log(`   🌍 Language: ${language}`);

    try {
      const startTime = Date.now();

      // Step 1: Create TTS task
      console.log('   📝 Creating voice generation task...');
      
      // Determine if we're using a cloned voice
      const isClone = !!voiceCloneId;
      // Use voiceCloneId directly (this is clone.id from frontend), otherwise use voice, otherwise use default
      const voiceIdToUse = voiceCloneId || (voice && typeof voice === 'string' && voice.trim() ? voice.trim() : this.genaiproConfig.defaultVoiceId);
      
      if (!voiceIdToUse || (typeof voiceIdToUse === 'string' && !voiceIdToUse.trim())) {
        throw new Error(`Invalid voice_id: voice_id cannot be empty. Please provide a valid voice_id or voiceCloneId.`);
      }
      
      console.log(`   🎯 Voice ID to use: "${voiceIdToUse}" (is_clone: ${isClone})`);
      console.log(`   🔍 voiceCloneId param: "${voiceCloneId}", voice param: "${voice}", default: "${this.genaiproConfig.defaultVoiceId}"`);
      
      // Use Max API endpoint for voice generation (not labs/task)
      const taskPayload = {
        text: script,
        voice_id: voiceIdToUse,
        model_id: 'speech-2.5-hd-preview', // Use Max model
        speed: speed || this.genaiproConfig.defaultSpeed,
        language: language || 'Auto', // Use provided language or auto-detect
        is_clone: isClone, // Important: set to true when using cloned voice
        pitch: 0,
        volume: 1.0,
      };
      
      console.log(`   📤 Sending to API:`, JSON.stringify(taskPayload, null, 2));
      
      const taskResponse = await axios.post(
        `${this.genaiproConfig.baseURL}/max/tasks`,
        taskPayload,
        {
          headers: {
            'Authorization': `Bearer ${this.genaiproConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.genaiproConfig.timeout,
        }
      );

      const taskId = taskResponse.data.id; // Max API uses 'id' not 'task_id'
      if (!taskId) {
        throw new Error('No task ID returned from Genaipro API');
      }

      console.log(`   ⏳ Task created: ${taskId}, waiting for completion...`);
      if (isClone) {
        console.log(`   🎭 Using cloned voice: ${voiceIdToUse}`);
      }

      // Step 2: Poll for task completion
      const result = await this._pollGenaiproTask(taskId);

      // Step 3: Download the audio file
      console.log(`   📥 Downloading audio from: ${result.result}`);
      const audioResponse = await axios.get(result.result, {
        responseType: 'arraybuffer',
        timeout: 60000, // 1 minute for download
      });

      // Save audio file
      const audioPath = outputPath || path.join(
        paths.temp,
        `voice_${Date.now()}.mp3`
      );
      
      await fs.ensureDir(path.dirname(audioPath));
      await fs.writeFile(audioPath, audioResponse.data);

      const processingTime = Date.now() - startTime;

      console.log(`   ✅ Genaipro voice generated in ${processingTime}ms`);
      console.log(`   📁 Saved to: ${audioPath}`);

      return {
        success: true,
        audioPath,
        provider: 'genaipro',
        format: 'mp3',
        metadata: {
          voice: voiceCloneId || voice || this.genaiproConfig.defaultVoiceId,
          voiceCloneId: voiceCloneId || null,
          speed: speed || this.genaiproConfig.defaultSpeed,
          textLength: script.length,
          fileSize: audioResponse.data.length,
          processingTime,
          taskId,
          subtitleUrl: result.subtitle, // Optional subtitle file
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (error.response) {
        const errorData = typeof error.response.data === 'string' 
          ? error.response.data.substring(0, 200)
          : JSON.stringify(error.response.data).substring(0, 200);
        throw new Error(`Genaipro API error (${error.response.status}): ${errorData}`);
      }
      throw error;
    }
  }

  /**
   * Poll Genaipro task until completion
   * @private
   */
  async _pollGenaiproTask(taskId) {
    const startTime = Date.now();
    const maxWaitTime = this.genaiproConfig.taskMaxWaitTime;
    const pollInterval = this.genaiproConfig.taskPollInterval;

    while (true) {
      // Check if we've exceeded max wait time
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error(`Task ${taskId} timed out after ${maxWaitTime}ms`);
      }

      // Get task status
      const response = await axios.get(
        `${this.genaiproConfig.baseURL}/max/tasks/${taskId}`, // Use Max API endpoint
        {
          headers: {
            'Authorization': `Bearer ${this.genaiproConfig.apiKey}`,
          },
          timeout: this.genaiproConfig.timeout,
        }
      );

      const task = response.data;
      
      if (task.status === 'completed') {
        console.log(`   ✅ Task completed in ${Date.now() - startTime}ms`);
        return task;
      } else if (task.status === 'failed' || task.status === 'error') {
        const errorDetails = task.error || task.message || JSON.stringify(task);
        throw new Error(`Task failed: ${errorDetails}`);
      }

      // Task still processing, wait before next poll
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`   ⏳ Task status: ${task.status} (${task.process_percentage || 0}%) - ${elapsed}s elapsed, waiting ${pollInterval}ms...`);
      
      // Log full task details if stuck at 0% for more than 30 seconds
      if (elapsed > 30 && (task.process_percentage || 0) === 0) {
        console.log(`   ⚠️  Task appears stuck at 0%. Full task data:`, JSON.stringify(task, null, 2));
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Generate voice using Fal.AI API (Fallback)
   * NOTE: Fal.AI TTS endpoint needs to be researched and implemented
   * This is a placeholder for the correct endpoint
   * @private
   */
  async _generateWithFalAI(script, voice, speed, outputPath) {
    if (!this.falAIConfig.apiKey) {
      throw new Error('FAL_AI_API_KEY not configured');
    }

    console.log('   🌐 Using Fal.AI (fallback)...');

    try {
      const startTime = Date.now();

      // TODO: Research actual Fal.AI TTS endpoint
      // This is a placeholder - update with correct endpoint
      // Possible endpoints: fal-ai/metavoice, fal-ai/tts, etc.
      
      const response = await axios.post(
        'https://fal.run/fal-ai/metavoice', // Example - needs verification
        {
          text: script,
          voice: voice,
          speed: speed || 1.0,
        },
        {
          headers: {
            'Authorization': `Key ${this.falAIConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const processingTime = Date.now() - startTime;

      // Download audio from URL
      const audioUrl = response.data.audio_url || response.data.url;
      if (!audioUrl) {
        throw new Error('No audio URL in Fal.AI response');
      }

      const audioResponse = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
      });

      // Save audio file
      const audioPath = outputPath || path.join(
        paths.temp,
        `voice_fal_${Date.now()}.mp3`
      );
      
      await fs.ensureDir(path.dirname(audioPath));
      await fs.writeFile(audioPath, audioResponse.data);

      console.log(`   ✅ Fal.AI voice generated in ${processingTime}ms`);
      console.log(`   📁 Saved to: ${audioPath}`);

      return {
        success: true,
        audioPath,
        provider: 'fal-ai',
        format: 'mp3',
        metadata: {
          voice,
          speed,
          textLength: script.length,
          fileSize: audioResponse.data.length,
          processingTime,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (error.response) {
        throw new Error(`Fal.AI API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Get audio duration using ffprobe (if available) or estimate
   * @private
   */
  async _getAudioDuration(audioPath) {
    try {
      // Try to get actual duration using ffprobe if available
      const { execSync } = require('child_process');
      const output = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
        { encoding: 'utf8' }
      );
      return parseFloat(output.trim());
    } catch (error) {
      // Fallback: estimate based on file size (rough estimate)
      const stats = await fs.stat(audioPath);
      const bitrate = 128000; // Assume 128 kbps MP3
      const duration = (stats.size * 8) / bitrate;
      return Math.round(duration);
    }
  }

  /**
   * Get available voices from Genaipro.vn
   * @returns {Promise<array>} List of available voices
   */
  async getAvailableVoices() {
    if (!this.genaiproConfig.apiKey) {
      console.warn('⚠️  GENAIPRO_API_KEY not configured, returning default voices');
      return this._getDefaultVoices();
    }

    try {
      const response = await axios.get(
        `${this.genaiproConfig.baseURL}${this.genaiproConfig.endpoints.voiceList}`,
        {
          headers: {
            'Authorization': `Bearer ${this.genaiproConfig.apiKey}`,
          },
          timeout: 10000,
        }
      );

      return response.data.voices || this._getDefaultVoices();
    } catch (error) {
      console.error('❌ Error fetching available voices:', error.message);
      return this._getDefaultVoices();
    }
  }

  /**
   * Test both voice providers
   * @returns {Promise<object>} Test results for both providers
   */
  async testProviders() {
    console.log('\n🧪 Testing Voice Providers...\n');

    const testText = "Hello, this is a test of the voice generation system.";
    const results = {
      genaipro: { tested: false, success: false, error: null, time: 0 },
      falAI: { tested: false, success: false, error: null, time: 0 },
    };

    // Test Genaipro
    try {
      console.log('Testing Genaipro.vn...');
      const startTime = Date.now();
      const result = await this.generateVoice(testText, { provider: 'genaipro' });
      results.genaipro = {
        tested: true,
        success: true,
        error: null,
        time: Date.now() - startTime,
        audioPath: result.audioPath,
        fileSize: result.metadata.fileSize,
      };
      console.log('✅ Genaipro test passed');
    } catch (error) {
      results.genaipro = {
        tested: true,
        success: false,
        error: error.message,
        time: 0,
      };
      console.log('❌ Genaipro test failed:', error.message);
    }

    // Test Fal.AI
    try {
      console.log('\nTesting Fal.AI...');
      const startTime = Date.now();
      const result = await this.generateVoice(testText, { provider: 'fal' });
      results.falAI = {
        tested: true,
        success: true,
        error: null,
        time: Date.now() - startTime,
        audioPath: result.audioPath,
        fileSize: result.metadata.fileSize,
      };
      console.log('✅ Fal.AI test passed');
    } catch (error) {
      results.falAI = {
        tested: true,
        success: false,
        error: error.message,
        time: 0,
      };
      console.log('❌ Fal.AI test failed:', error.message);
    }

    console.log('\n📊 Test Results:');
    console.log(JSON.stringify(results, null, 2));

    return results;
  }

  /**
   * Get default voices (fallback)
   * @private
   */
  _getDefaultVoices() {
    return [
      { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced' },
      { id: 'echo', name: 'Echo', description: 'Deep, authoritative' },
      { id: 'fable', name: 'Fable', description: 'Warm, storytelling' },
      { id: 'onyx', name: 'Onyx', description: 'Deep, professional' },
      { id: 'nova', name: 'Nova', description: 'Energetic, engaging' },
      { id: 'shimmer', name: 'Shimmer', description: 'Soft, pleasant' },
    ];
  }
}

module.exports = VoiceService;
