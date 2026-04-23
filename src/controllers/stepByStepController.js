const ClaudeService = require('../services/claudeService');
const VoiceService = require('../services/voiceService');
const ImageService = require('../services/imageService');
const SessionStorageService = require('../services/sessionStorageService');
const { matchImagesToSentences, groupSentencesIntoBlocks, generateImagePromptsFromBlocks } = require('../utils/imageScriptMatcher');
const { getQueue } = require('../queues');

/**
 * Step-by-Step Video Generation Controller
 * Handles the new preview/review workflow
 */
class StepByStepController {
  /**
   * POST /api/v2/video/generate-script
   * Generate script only (Step 1)
   */
  static async generateScript(req, res) {
    try {
      const {
        title,
        context = '',
        customPrompt = '',
        referenceScripts = [],
        promptTemplateId = null,
        targetDuration = null,
        channelId = null,
      } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      console.log(`\n📝 Step 1: Generating script for "${title}"...`);

      // Get channel configuration if provided (for language settings)
      let channelConfig = null;
      let language = 'English'; // Default language
      if (channelId) {
        try {
          const StorageService = require('../services/storageService');
          const storageService = new StorageService();
          channelConfig = await storageService.getChannel(channelId);
          language = channelConfig.voiceSettings?.language || 'English';
          console.log(`   📚 Using channel: ${channelConfig.name}`);
          console.log(`   🌍 Script language: ${language}`);
        } catch (error) {
          console.warn(`⚠️  Could not load channel ${channelId}:`, error.message);
        }
      }

      // Create new session
      const sessionService = new SessionStorageService();
      const session = await sessionService.createSession({
        title,
        channelId,
        targetDuration,
        targetWordCount: targetDuration ? Math.round(targetDuration * 2.5) : null,
      });

      // Generate script
      const claudeService = new ClaudeService();
      const scriptResult = await claudeService.generateScript({
        title,
        context,
        customPrompt,
        referenceScripts,
        promptTemplateId,
        targetDuration,
        language, // Pass language from channel voice settings
      });

      // Save script to session
      await sessionService.saveScript(session.sessionId, scriptResult);

      console.log(`✅ Script generated and saved to session ${session.sessionId}`);

      res.json({
        success: true,
        sessionId: session.sessionId,
        script: scriptResult.script,
        sentences: scriptResult.sentences,
        wordCount: scriptResult.wordCount,
        estimatedDuration: scriptResult.estimatedDuration,
        metadata: scriptResult.metadata,
      });
    } catch (error) {
      console.error('❌ Script generation error:', error.message);
      res.status(500).json({
        error: 'Script generation failed',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v2/video/generate-voice
   * Generate voice narration (Step 2)
   */
  static async generateVoice(req, res) {
    try {
      const {
        sessionId,
        scriptOverride = null, // Allow user to edit script before voice generation
        voiceSettings = {},
      } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      console.log(`\n🎙️  Step 2: Generating voice for session ${sessionId}...`);

      // Get session
      const sessionService = new SessionStorageService();
      const session = await sessionService.getSession(sessionId);

      // Use override script if provided, otherwise use session script
      const scriptText = scriptOverride || session.assets.script.script;

      if (!scriptText) {
        return res.status(400).json({ error: 'No script available' });
      }

      // Get channel configuration for voice settings
      let channelVoiceSettings = {};
      if (session.channelId) {
        try {
          const StorageService = require('../services/storageService');
          const storageService = new StorageService();
          const channelConfig = await storageService.getChannel(session.channelId);
          channelVoiceSettings = channelConfig.voiceSettings || {};
          
          if (channelVoiceSettings.voiceCloneId) {
            console.log(`   🎭 Using voice clone: ${channelVoiceSettings.voiceCloneId}`);
            console.log(`   🌍 Language: ${channelVoiceSettings.language || 'Auto'}`);
          }
        } catch (error) {
          console.warn(`⚠️  Could not load channel ${session.channelId}:`, error.message);
        }
      }

      // Merge voice settings (request override takes precedence, then channel settings)
      const finalVoiceSettings = {
        provider: channelVoiceSettings.provider || 'genaipro',
        voice: channelVoiceSettings.voice,
        voiceCloneId: channelVoiceSettings.voiceCloneId || null,
        speed: channelVoiceSettings.speed || 1.0,
        ...voiceSettings, // Request can override
      };

      // Generate voice
      const voiceService = new VoiceService();
      const voiceResult = await voiceService.generateVoice(scriptText, finalVoiceSettings);

      // If script was overridden, update session with new script
      if (scriptOverride && scriptOverride !== session.assets.script.script) {
        const claudeService = new ClaudeService();
        const updatedSentences = claudeService._parseScriptIntoSentences(scriptOverride);
        
        await sessionService.saveScript(sessionId, {
          script: scriptOverride,
          sentences: updatedSentences,
          wordCount: scriptOverride.split(/\s+/).length,
          estimatedDuration: Math.ceil(scriptOverride.split(/\s+/).length / 2.5),
          metadata: { edited: true, editedAt: new Date().toISOString() },
        });
      }

      // Save voice to session
      await sessionService.saveVoice(sessionId, voiceResult);

      console.log(`✅ Voice generated and saved to session ${sessionId}`);

      res.json({
        success: true,
        sessionId,
        audioPath: voiceResult.audioPath,
        duration: voiceResult.duration,
        provider: voiceResult.provider,
        metadata: voiceResult.metadata,
      });
    } catch (error) {
      console.error('❌ Voice generation error:', error.message);
      res.status(500).json({
        error: 'Voice generation failed',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v2/video/generate-images
   * Generate images matched to script sentences (Step 3)
   */
  static async generateImages(req, res) {
    try {
      const {
        sessionId,
        numberOfImages = 5,
        imageStyle = 'realistic, cinematic',
        customPrompts = null, // Allow custom prompts per image
      } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      console.log(`\n🎨 Step 3: Generating ${numberOfImages} images for session ${sessionId}...`);

      // Get session
      const sessionService = new SessionStorageService();
      const session = await sessionService.getSession(sessionId);

      if (!session.assets.script) {
        return res.status(400).json({ error: 'Script not found in session' });
      }

      if (!session.assets.voice) {
        return res.status(400).json({ error: 'Voice not found in session' });
      }

      const { sentences, script } = session.assets.script;
      const { duration: audioDuration } = session.assets.voice;

      // Group sentences into blocks for image generation
      const sentenceBlocks = groupSentencesIntoBlocks(sentences, numberOfImages);

      // Generate image prompts from sentence blocks
      let imagePrompts;
      
      if (customPrompts && customPrompts.length === numberOfImages) {
        // Use custom prompts if provided
        imagePrompts = customPrompts;
        console.log(`   Using ${customPrompts.length} custom prompts`);
      } else {
        // Try to use Claude AI for intelligent prompt generation
        try {
          console.log(`   🤖 Using Claude AI for context-aware image prompts...`);
          const claudeService = new ClaudeService();
          const claudeResult = await claudeService.generateImagePrompts(script, numberOfImages);
          
          if (claudeResult.success && claudeResult.imagePrompts) {
            // Enhance Claude's prompts with the requested image style
            imagePrompts = claudeResult.imagePrompts.map(ip => {
              const basePrompt = ip.prompt || ip.description;
              return `${basePrompt}, ${imageStyle}, high quality, detailed, professional photography, cinematic lighting`;
            });
            console.log(`   ✅ Generated ${imagePrompts.length} AI-powered prompts from script context`);
          } else {
            throw new Error('Claude prompt generation failed');
          }
        } catch (aiError) {
          console.warn(`   ⚠️  AI prompt generation failed: ${aiError.message}`);
          console.log(`   📝 Falling back to text-based prompt extraction...`);
          
          // Fallback: Auto-generate prompts from sentence blocks
          const autoPrompts = generateImagePromptsFromBlocks(sentenceBlocks, imageStyle);
          imagePrompts = autoPrompts.map(p => p.prompt);
          console.log(`   Generated ${imagePrompts.length} prompts from script text`);
        }
      }

      // Generate images
      const imageService = new ImageService();
      const imagesResult = await imageService.generateImages(imagePrompts, {
        aspectRatio: '16:9',
        quality: 'standard',
      });

      // Match images to sentences with timing
      const imageBlocks = matchImagesToSentences(
        sentences,
        imagesResult.filter(r => r.success),
        audioDuration
      );

      // Save images to session
      await sessionService.saveImages(sessionId, imagesResult, imageBlocks);

      console.log(`✅ Images generated and saved to session ${sessionId}`);

      res.json({
        success: true,
        sessionId,
        images: imagesResult,
        imageBlocks,
        successCount: imagesResult.filter(r => r.success).length,
        totalCount: imagesResult.length,
      });
    } catch (error) {
      console.error('❌ Image generation error:', error.message);
      res.status(500).json({
        error: 'Image generation failed',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v2/video/regenerate-asset
   * Regenerate a specific asset (script, voice, or single image)
   */
  static async regenerateAsset(req, res) {
    try {
      const {
        sessionId,
        assetType, // 'script', 'voice', 'image'
        imageIndex = null, // Required if assetType is 'image'
        customPrompt = null, // For image regeneration
      } = req.body;

      if (!sessionId || !assetType) {
        return res.status(400).json({ error: 'Session ID and asset type required' });
      }

      console.log(`\n🔄 Regenerating ${assetType} for session ${sessionId}...`);

      const sessionService = new SessionStorageService();
      const session = await sessionService.getSession(sessionId);

      switch (assetType) {
        case 'image':
          if (imageIndex === null || imageIndex === undefined) {
            return res.status(400).json({ error: 'Image index required' });
          }

          const imageService = new ImageService();
          const prompt = customPrompt || session.assets.images[imageIndex].prompt;
          
          const newImageResult = await imageService.generateImages([prompt], {
            aspectRatio: '16:9',
            quality: 'standard',
          });

          if (newImageResult[0].success) {
            await sessionService.regenerateAsset(sessionId, 'image', newImageResult[0], imageIndex);
            
            res.json({
              success: true,
              sessionId,
              assetType: 'image',
              imageIndex,
              newImage: newImageResult[0],
            });
          } else {
            throw new Error('Image regeneration failed');
          }
          break;

        default:
          res.status(400).json({ error: `Asset type ${assetType} regeneration not implemented` });
      }
    } catch (error) {
      console.error('❌ Asset regeneration error:', error.message);
      res.status(500).json({
        error: 'Asset regeneration failed',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v2/video/generate-final
   * Generate final video from approved assets (Step 4)
   */
  static async generateFinal(req, res) {
    try {
      const {
        sessionId,
        channelId,
        channelConfig = {},
      } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      console.log(`\n🎬 Step 4: Generating final video for session ${sessionId}...`);

      // Get session
      const sessionService = new SessionStorageService();
      const session = await sessionService.getSession(sessionId);

      // Determine channel type
      const channelType = channelConfig.type || 'TYPE_2';
      console.log(`   📋 Channel Type: ${channelType}`);

      // Validate all assets are ready (TYPE_1 doesn't need images)
      const validation = sessionService.validateSessionAssets(session, channelType);
      
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Session not ready for video generation',
          details: validation.errors,
        });
      }

      // Mark session as ready
      await sessionService.markReadyForVideo(sessionId, channelType);

      // Queue video generation job
      const videoQueue = getQueue('videoProcessing');
      
      // For TYPE_1, images array will be empty (uses background videos instead)
      // For TYPE_2, images array contains AI-generated images
      const images = (session.assets.images || []).map(img => ({
        imagePath: img.path,
        prompt: img.prompt,
      }));
      
      if (channelType === 'TYPE_1') {
        console.log(`   📹 TYPE_1: Using background videos (${images.length} images skipped)`);
      } else {
        console.log(`   🖼️  TYPE_2: Using ${images.length} generated images`);
      }
      
      const videoJob = await videoQueue.add({
        projectId: sessionId,
        audioPath: session.assets.voice.audioPath,
        images: images,
        script: session.assets.script.script,
        sentences: session.assets.script.sentences,
        settings: {
          fps: 30,
          resolution: '1920x1080',
        },
        channelConfig: channelConfig,
        type: channelConfig.type || 'TYPE_2',
      }, {
        priority: 1,
        attempts: 2,
      });

      console.log(`✅ Video generation queued: Job ${videoJob.id}`);

      res.json({
        success: true,
        sessionId,
        jobId: videoJob.id,
        message: 'Final video generation started',
        queueName: 'videoProcessing',
      });
    } catch (error) {
      console.error('❌ Final video generation error:', error.message);
      res.status(500).json({
        error: 'Final video generation failed',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v2/video/session/:sessionId
   * Get session data and all assets
   */
  static async getSession(req, res) {
    try {
      const { sessionId } = req.params;

      const sessionService = new SessionStorageService();
      const session = await sessionService.getSession(sessionId);

      res.json({
        success: true,
        session,
      });
    } catch (error) {
      console.error('❌ Get session error:', error.message);
      res.status(404).json({
        error: 'Session not found',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v2/video/sessions
   * List all active sessions
   */
  static async listSessions(req, res) {
    try {
      const sessionService = new SessionStorageService();
      const sessions = await sessionService.listSessions();

      res.json({
        success: true,
        sessions,
        count: sessions.length,
      });
    } catch (error) {
      console.error('❌ List sessions error:', error.message);
      res.status(500).json({
        error: 'Failed to list sessions',
        message: error.message,
      });
    }
  }

  /**
   * DELETE /api/v2/video/session/:sessionId
   * Delete a session and all its assets
   */
  static async deleteSession(req, res) {
    try {
      const { sessionId } = req.params;

      const sessionService = new SessionStorageService();
      await sessionService.deleteSession(sessionId);

      res.json({
        success: true,
        message: `Session ${sessionId} deleted`,
      });
    } catch (error) {
      console.error('❌ Delete session error:', error.message);
      res.status(500).json({
        error: 'Failed to delete session',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v2/video/sessions/channel/:channelId
   * Get previous sessions for a channel
   */
  static async getSessionsByChannel(req, res) {
    try {
      const { channelId } = req.params;

      if (!channelId) {
        return res.status(400).json({ error: 'Channel ID is required' });
      }

      console.log(`\n📚 Fetching sessions for channel: ${channelId}`);

      const sessionService = new SessionStorageService();
      const sessions = await sessionService.listSessionsByChannel(channelId);

      console.log(`   ✅ Found ${sessions.length} sessions for channel ${channelId}`);

      res.json({
        success: true,
        channelId,
        sessions,
        count: sessions.length,
      });
    } catch (error) {
      console.error('❌ Error fetching sessions:', error);
      res.status(500).json({
        error: 'Failed to fetch sessions',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v2/video/session/:sessionId
   * Get full session details for reuse
   */
  static async getSessionDetails(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      console.log(`\n📖 Fetching session details: ${sessionId}`);

      const sessionService = new SessionStorageService();
      const session = await sessionService.getSession(sessionId);

      console.log(`   ✅ Session loaded: ${session.title}`);

      res.json({
        success: true,
        session: {
          sessionId: session.sessionId,
          title: session.title,
          channelId: session.channelId,
          status: session.status,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          script: session.assets.script,
          voice: session.assets.voice,
          images: session.assets.images,
        },
      });
    } catch (error) {
      console.error('❌ Error fetching session:', error);
      res.status(500).json({
        error: 'Failed to fetch session',
        message: error.message,
      });
    }
  }
}

module.exports = StepByStepController;

