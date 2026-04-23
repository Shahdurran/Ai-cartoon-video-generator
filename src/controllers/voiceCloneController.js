const axios = require('axios');
const apiConfig = require('../config/api.config');
const { paths } = require('../config/paths.config');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Local voice clones storage file
const VOICE_CLONES_FILE = path.join(paths.storage, 'voice-clones.json');

// Configure multer for audio file uploads (temporary storage before sending to genAi pro)
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dest = path.join(process.cwd(), 'temp', 'voice-clones');
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
    fileSize: 20 * 1024 * 1024, // 20MB limit (as per API docs)
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.wav', '.mp3', '.mpeg', '.mp4', '.m4a', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'];
    
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowed.join(', ')}`));
    }
  },
});

class VoiceCloneController {
  /**
   * Load voice clones from local storage
   * @private
   */
  static async _loadLocalVoiceClones() {
    try {
      console.log(`📂 Loading voice clones from: ${VOICE_CLONES_FILE}`);
      const exists = await fs.pathExists(VOICE_CLONES_FILE);
      console.log(`   File exists: ${exists}`);
      
      if (exists) {
        const data = await fs.readJson(VOICE_CLONES_FILE);
        const clones = data.voiceClones || [];
        console.log(`   Loaded ${clones.length} clones from file`);
        return clones;
      }
      
      console.log(`   No file found, returning empty array`);
      return [];
    } catch (error) {
      console.error('❌ Error loading local voice clones:', error);
      return [];
    }
  }

  /**
   * Save voice clones to local storage
   * @private
   */
  static async _saveLocalVoiceClones(voiceClones) {
    try {
      await fs.ensureDir(path.dirname(VOICE_CLONES_FILE));
      const data = {
        voiceClones,
        lastUpdated: new Date().toISOString(),
      };
      await fs.writeJson(VOICE_CLONES_FILE, data, { spaces: 2 });
      console.log(`💾 Saved ${voiceClones.length} voice clones to: ${VOICE_CLONES_FILE}`);
      
      // Verify the file was written
      const exists = await fs.pathExists(VOICE_CLONES_FILE);
      console.log(`   File exists: ${exists}`);
      if (exists) {
        const fileContent = await fs.readJson(VOICE_CLONES_FILE);
        console.log(`   File contains ${fileContent.voiceClones?.length || 0} clones`);
      }
    } catch (error) {
      console.error('❌ Error saving local voice clones:', error);
      console.error('   File path:', VOICE_CLONES_FILE);
      throw error;
    }
  }

  /**
   * GET /api/v2/voice-clones
   * Get list of created voice clones (from local storage)
   * Query params: ?sync=true to sync with API first
   */
  static async listVoiceClones(req, res) {
    try {
      const { sync } = req.query;

      // If sync requested, fetch from API and merge with local
      if (sync === 'true' && apiConfig.genaipro?.apiKey) {
        try {
          console.log('🔄 Syncing voice clones with genAi pro API...');
          const response = await axios.get(
            `${apiConfig.genaipro.baseURL}/max/voice-clones`,
            {
              headers: {
                'Authorization': `Bearer ${apiConfig.genaipro.apiKey}`,
              },
              timeout: apiConfig.genaipro.timeout || 30000,
            }
          );

          const apiVoiceClones = response.data.voice_clones || [];
          console.log(`   📡 API returned ${apiVoiceClones.length} voice clones`);

          // Merge with local storage (API is source of truth)
          await VoiceCloneController._saveLocalVoiceClones(apiVoiceClones);
          
          return res.json({
            success: true,
            voiceClones: apiVoiceClones,
            total: apiVoiceClones.length,
            limit: response.data.limit || 30,
            synced: true,
          });
        } catch (syncError) {
          console.warn('⚠️  API sync failed, falling back to local storage:', syncError.message);
        }
      }

      // Default: return from local storage
      console.log('📋 Fetching voice clones from local storage...');
      const voiceClones = await VoiceCloneController._loadLocalVoiceClones();
      
      console.log(`✅ Found ${voiceClones.length} voice clones in local storage`);

      res.json({
        success: true,
        voiceClones: voiceClones,
        total: voiceClones.length,
        limit: 30,
        synced: false,
      });
    } catch (error) {
      console.error('❌ List voice clones error:', error.message);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch voice clones',
      });
    }
  }

  /**
   * POST /api/v2/voice-clones
   * Create voice clone from audio file
   */
  static async createVoiceClone(req, res) {
    try {
      if (!apiConfig.genaipro?.apiKey) {
        return res.status(400).json({
          success: false,
          error: 'GENAIPRO_API_KEY not configured',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Audio file is required',
        });
      }

      const { voice_name, language_tag = 'Vietnamese', preview_text = '', need_noise_reduction = false } = req.body;

      if (!voice_name) {
        // Clean up uploaded file
        await fs.remove(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'Voice name is required',
        });
      }

      // Create FormData for genAi pro API
      const FormData = require('form-data');
      const formData = new FormData();
      
      formData.append('voice_name', voice_name);
      formData.append('audio_file', fs.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: req.file.mimetype || 'audio/mpeg',
      });
      formData.append('language_tag', language_tag);
      if (preview_text) {
        formData.append('preview_text', preview_text);
      }
      formData.append('need_noise_reduction', need_noise_reduction === 'true' || need_noise_reduction === true ? 'true' : 'false');

      console.log(`🎙️  Creating voice clone: ${voice_name} (${language_tag})`);

      const response = await axios.post(
        `${apiConfig.genaipro.baseURL}/max/voice-clones`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${apiConfig.genaipro.apiKey}`,
            ...formData.getHeaders(),
          },
          timeout: 300000, // 5 minutes for voice clone creation (can take a while)
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      // Clean up temporary file
      await fs.remove(req.file.path).catch(err => {
        console.warn('Failed to clean up temp file:', err.message);
      });

      const voiceClone = response.data;
      console.log(`✅ Voice clone created: ${voiceClone.voice_name} (ID: ${voiceClone.id})`);
      console.log(`   Voice clone data:`, JSON.stringify(voiceClone, null, 2));

      // Save to local storage
      console.log('💾 Saving voice clone to local storage...');
      const localVoiceClones = await VoiceCloneController._loadLocalVoiceClones();
      console.log(`   Current local clones count: ${localVoiceClones.length}`);
      
      // Add new voice clone to local storage (avoid duplicates)
      const existingIndex = localVoiceClones.findIndex(vc => vc.id === voiceClone.id);
      if (existingIndex >= 0) {
        console.log(`   Updating existing clone at index ${existingIndex}`);
        localVoiceClones[existingIndex] = voiceClone;
      } else {
        console.log(`   Adding new clone to storage`);
        localVoiceClones.push(voiceClone);
      }
      
      await VoiceCloneController._saveLocalVoiceClones(localVoiceClones);
      console.log(`   ✅ Saved! New total: ${localVoiceClones.length} clones`);

      res.json({
        success: true,
        voiceClone: voiceClone,
      });
    } catch (error) {
      console.error('Create voice clone error:', error);

      // Clean up temporary file on error
      if (req.file?.path) {
        await fs.remove(req.file.path).catch(err => {
          console.warn('Failed to clean up temp file:', err.message);
        });
      }

      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data?.message || error.response.statusText,
          details: error.response.data,
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create voice clone',
      });
    }
  }

  /**
   * DELETE /api/v2/voice-clones/:id
   * Delete a voice clone (if API supports it)
   */
  static async deleteVoiceClone(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Voice clone ID is required',
        });
      }

      // Try to delete from API (optional, may fail if API doesn't support it)
      if (apiConfig.genaipro?.apiKey) {
        try {
          await axios.delete(
            `${apiConfig.genaipro.baseURL}/max/voice-clones/${id}`,
            {
              headers: {
                'Authorization': `Bearer ${apiConfig.genaipro.apiKey}`,
              },
              timeout: apiConfig.genaipro.timeout || 30000,
            }
          );
          console.log(`✅ Voice clone deleted from API: ${id}`);
        } catch (apiError) {
          console.warn('⚠️  API deletion failed (continuing with local deletion):', apiError.message);
        }
      }

      // Delete from local storage
      const localVoiceClones = await VoiceCloneController._loadLocalVoiceClones();
      const filteredClones = localVoiceClones.filter(vc => vc.id !== id);
      await VoiceCloneController._saveLocalVoiceClones(filteredClones);

      console.log(`✅ Voice clone deleted from local storage: ${id}`);

      res.json({
        success: true,
        message: 'Voice clone deleted successfully',
      });
    } catch (error) {
      console.error('Delete voice clone error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete voice clone',
      });
    }
  }
}

module.exports = {
  VoiceCloneController,
  upload,
};

