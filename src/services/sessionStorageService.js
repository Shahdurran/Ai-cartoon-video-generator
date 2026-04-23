const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { paths } = require('../config/paths.config');

/**
 * Session Storage Service
 * Manages temporary asset storage for step-by-step video generation
 */
class SessionStorageService {
  constructor() {
    this.baseDir = path.join(paths.storage, 'generated-assets');
    this._ensureBaseDir();
  }

  async _ensureBaseDir() {
    await fs.ensureDir(this.baseDir);
  }

  /**
   * Create a new session
   * @param {object} initialData - Initial session data
   * @returns {Promise<object>} Session object with ID
   */
  async createSession(initialData = {}) {
    const sessionId = `session_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const sessionDir = path.join(this.baseDir, sessionId);
    
    await fs.ensureDir(sessionDir);
    await fs.ensureDir(path.join(sessionDir, 'images'));
    
    const session = {
      sessionId,
      title: initialData.title || 'Untitled',
      channelId: initialData.channelId || null,
      status: 'initialized',
      steps: {
        script: { status: 'pending', completed: false },
        voice: { status: 'pending', completed: false },
        images: { status: 'pending', completed: false },
        video: { status: 'pending', completed: false },
      },
      assets: {
        script: null,
        voice: null,
        images: [],
        video: null,
      },
      config: {
        targetDuration: initialData.targetDuration || null,
        targetWordCount: initialData.targetWordCount || null,
        numberOfImages: initialData.numberOfImages || 5,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await this.saveSession(session);
    
    console.log(`✨ Created new session: ${sessionId}`);
    return session;
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<object>} Session object
   */
  async getSession(sessionId) {
    const metadataPath = path.join(this.baseDir, sessionId, 'metadata.json');
    
    if (!await fs.pathExists(metadataPath)) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    const session = await fs.readJson(metadataPath);
    return session;
  }

  /**
   * Save session data
   * @param {object} session - Session object
   * @returns {Promise<void>}
   */
  async saveSession(session) {
    const sessionDir = path.join(this.baseDir, session.sessionId);
    const metadataPath = path.join(sessionDir, 'metadata.json');
    
    await fs.ensureDir(sessionDir);
    
    session.updatedAt = new Date().toISOString();
    
    await fs.writeJson(metadataPath, session, { spaces: 2 });
  }

  /**
   * Save script to session
   * @param {string} sessionId - Session ID
   * @param {object} scriptData - Script data (script text, sentences, metadata)
   * @returns {Promise<object>} Updated session
   */
  async saveScript(sessionId, scriptData) {
    const session = await this.getSession(sessionId);
    const scriptPath = path.join(this.baseDir, sessionId, 'script.json');
    
    const scriptAsset = {
      script: scriptData.script,
      sentences: scriptData.sentences,
      wordCount: scriptData.wordCount,
      estimatedDuration: scriptData.estimatedDuration,
      metadata: scriptData.metadata,
      savedAt: new Date().toISOString(),
    };
    
    await fs.writeJson(scriptPath, scriptAsset, { spaces: 2 });
    
    session.assets.script = scriptAsset;
    session.steps.script = {
      status: 'completed',
      completed: true,
      completedAt: new Date().toISOString(),
    };
    
    await this.saveSession(session);
    
    console.log(`📝 Script saved to session ${sessionId}`);
    return session;
  }

  /**
   * Save voice audio to session
   * @param {string} sessionId - Session ID
   * @param {object} voiceData - Voice data (audioPath, duration, metadata)
   * @returns {Promise<object>} Updated session
   */
  async saveVoice(sessionId, voiceData) {
    const session = await this.getSession(sessionId);
    const sessionDir = path.join(this.baseDir, sessionId);
    
    // Copy audio file to session directory
    const audioFileName = `voice_${Date.now()}.mp3`;
    const audioPath = path.join(sessionDir, audioFileName);
    
    if (voiceData.audioPath && await fs.pathExists(voiceData.audioPath)) {
      await fs.copy(voiceData.audioPath, audioPath);
    }
    
    const voiceAsset = {
      audioPath: audioPath,
      duration: voiceData.duration,
      provider: voiceData.provider,
      metadata: voiceData.metadata,
      savedAt: new Date().toISOString(),
    };
    
    session.assets.voice = voiceAsset;
    session.steps.voice = {
      status: 'completed',
      completed: true,
      completedAt: new Date().toISOString(),
    };
    
    await this.saveSession(session);
    
    console.log(`🎙️  Voice saved to session ${sessionId}`);
    return session;
  }

  /**
   * Save images to session
   * @param {string} sessionId - Session ID
   * @param {array} imagesData - Array of image data
   * @param {array} imageBlocks - Image-sentence mapping blocks
   * @returns {Promise<object>} Updated session
   */
  async saveImages(sessionId, imagesData, imageBlocks = []) {
    const session = await this.getSession(sessionId);
    const sessionImagesDir = path.join(this.baseDir, sessionId, 'images');
    
    const savedImages = [];
    
    for (let i = 0; i < imagesData.length; i++) {
      const imageData = imagesData[i];
      
      if (!imageData.success || !imageData.imagePath) {
        console.warn(`⚠️  Skipping failed image ${i + 1}`);
        continue;
      }
      
      // Copy image to session directory
      const imageFileName = `image_${i + 1}.png`;
      const sessionImagePath = path.join(sessionImagesDir, imageFileName);
      
      if (await fs.pathExists(imageData.imagePath)) {
        await fs.copy(imageData.imagePath, sessionImagePath);
        
        savedImages.push({
          index: i,
          path: sessionImagePath,
          prompt: imageData.prompt,
          metadata: imageData.metadata,
          block: imageBlocks[i] || null,
        });
      }
    }
    
    session.assets.images = savedImages;
    session.assets.imageBlocks = imageBlocks;
    session.steps.images = {
      status: 'completed',
      completed: true,
      completedAt: new Date().toISOString(),
      count: savedImages.length,
    };
    
    await this.saveSession(session);
    
    console.log(`🎨 ${savedImages.length} images saved to session ${sessionId}`);
    return session;
  }

  /**
   * Regenerate a single asset (script, voice, or specific image)
   * @param {string} sessionId - Session ID
   * @param {string} assetType - 'script', 'voice', or 'image'
   * @param {object} newData - New asset data
   * @param {number} imageIndex - If regenerating image, which index
   * @returns {Promise<object>} Updated session
   */
  async regenerateAsset(sessionId, assetType, newData, imageIndex = null) {
    const session = await this.getSession(sessionId);
    
    switch (assetType) {
      case 'script':
        return await this.saveScript(sessionId, newData);
      
      case 'voice':
        return await this.saveVoice(sessionId, newData);
      
      case 'image':
        if (imageIndex === null) {
          throw new Error('Image index required for image regeneration');
        }
        
        // Replace specific image
        const sessionImagesDir = path.join(this.baseDir, sessionId, 'images');
        const imageFileName = `image_${imageIndex + 1}.png`;
        const sessionImagePath = path.join(sessionImagesDir, imageFileName);
        
        if (newData.imagePath && await fs.pathExists(newData.imagePath)) {
          await fs.copy(newData.imagePath, sessionImagePath);
          
          session.assets.images[imageIndex] = {
            index: imageIndex,
            path: sessionImagePath,
            prompt: newData.prompt,
            metadata: newData.metadata,
            regeneratedAt: new Date().toISOString(),
          };
          
          await this.saveSession(session);
          console.log(`🔄 Image ${imageIndex + 1} regenerated in session ${sessionId}`);
        }
        
        return session;
      
      default:
        throw new Error(`Unknown asset type: ${assetType}`);
    }
  }

  /**
   * Mark session as ready for final video generation
   * @param {string} sessionId - Session ID
   * @param {string} channelType - Channel type (TYPE_1 or TYPE_2)
   * @returns {Promise<object>} Updated session
   */
  async markReadyForVideo(sessionId, channelType = 'TYPE_2') {
    const session = await this.getSession(sessionId);
    
    // Validate all required assets are present
    const validation = this.validateSessionAssets(session, channelType);
    
    if (!validation.valid) {
      throw new Error(`Session not ready: ${validation.errors.join(', ')}`);
    }
    
    session.status = 'ready_for_video';
    await this.saveSession(session);
    
    console.log(`✅ Session ${sessionId} ready for final video generation (${channelType})`);
    return session;
  }

  /**
   * Validate session has all required assets
   * @param {object} session - Session object
   * @param {string} channelType - Channel type (TYPE_1 or TYPE_2)
   * @returns {object} Validation result
   */
  validateSessionAssets(session, channelType = 'TYPE_2') {
    const errors = [];
    
    if (!session.assets.script) {
      errors.push('Script not generated');
    }
    
    if (!session.assets.voice || !session.assets.voice.audioPath) {
      errors.push('Voice not generated');
    }
    
    // TYPE_1 channels use background videos, so images are not required
    // TYPE_2 channels need AI-generated images
    if (channelType !== 'TYPE_1') {
      if (!session.assets.images || session.assets.images.length === 0) {
        errors.push('No images generated');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      assetsReady: {
        script: !!session.assets.script,
        voice: !!session.assets.voice,
        images: session.assets.images.length > 0,
      },
    };
  }

  /**
   * Get all active sessions
   * @returns {Promise<array>} Array of session summaries
   */
  async listSessions() {
    await this._ensureBaseDir();
    
    const sessionDirs = await fs.readdir(this.baseDir);
    const sessions = [];
    
    for (const dir of sessionDirs) {
      if (dir.startsWith('session_')) {
        try {
          const session = await this.getSession(dir);
          sessions.push({
            sessionId: session.sessionId,
            title: session.title,
            status: session.status,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            channelId: session.channelId,
            hasScript: !!session.assets.script,
            hasVoice: !!session.assets.voice,
            hasImages: session.assets.images.length > 0,
            wordCount: session.assets.script?.wordCount,
            audioDuration: session.assets.voice?.duration,
          });
        } catch (err) {
          console.warn(`⚠️  Failed to load session ${dir}:`, err.message);
        }
      }
    }
    
    return sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Get sessions for a specific channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<array>} Array of session summaries for the channel
   */
  async listSessionsByChannel(channelId) {
    const allSessions = await this.listSessions();
    return allSessions.filter(session => session.channelId === channelId);
  }

  /**
   * Delete session and all its assets
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async deleteSession(sessionId) {
    const sessionDir = path.join(this.baseDir, sessionId);
    
    if (await fs.pathExists(sessionDir)) {
      await fs.remove(sessionDir);
      console.log(`🗑️  Session ${sessionId} deleted`);
    }
  }

  /**
   * Clean up old sessions (older than X days)
   * @param {number} daysOld - Delete sessions older than this many days
   * @returns {Promise<number>} Number of sessions deleted
   */
  async cleanupOldSessions(daysOld = 7) {
    const sessions = await this.listSessions();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let deletedCount = 0;
    
    for (const session of sessions) {
      const sessionDate = new Date(session.createdAt);
      
      if (sessionDate < cutoffDate) {
        await this.deleteSession(session.sessionId);
        deletedCount++;
      }
    }
    
    console.log(`🧹 Cleaned up ${deletedCount} old session(s)`);
    return deletedCount;
  }
}

module.exports = SessionStorageService;

