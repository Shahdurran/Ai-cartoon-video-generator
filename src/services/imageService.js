const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const apiConfig = require('../config/api.config');
const { paths } = require('../config/paths.config');

// Aspect ratio mapping for Fal.AI
const ASPECT_RATIO_MAP = {
  '1:1': 'square',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
  '3:4': 'portrait_4_3',
  '21:9': 'landscape_21_9'
};

class ImageService {
  constructor() {
    this.falAIConfig = apiConfig.falAI;
    this.defaultModel = 'fal-ai/flux/dev';
  }

  /**
   * Generate images from prompts using Fal.AI Flux
   * @param {array} prompts - Array of prompt strings or objects
   * @param {object} settings - Generation settings
   * @returns {Promise<array>} Array of {imagePath, prompt, index}
   */
  async generateImages(prompts, settings = {}) {
    if (!Array.isArray(prompts) || prompts.length === 0) {
      throw new Error('Prompts must be a non-empty array');
    }

    if (!process.env.FAL_AI_API_KEY) {
      throw new Error('FAL_AI_API_KEY not configured');
    }

    const {
      aspectRatio = '16:9',
      quality = 'standard',
      seed = null,
      model = 'dev' // 'dev' or 'pro'
    } = settings;

    console.log(`🎨 Generating ${prompts.length} image(s) with Fal.AI Flux...`);
    console.log(`   Model: flux-${model}, Aspect ratio: ${aspectRatio}`);

    const results = [];
    
    for (let i = 0; i < prompts.length; i++) {
      const promptText = typeof prompts[i] === 'string' ? prompts[i] : prompts[i].prompt;
      const promptSettings = typeof prompts[i] === 'object' ? prompts[i].settings : {};

      try {
        console.log(`\n   [${i + 1}/${prompts.length}] ${promptText.substring(0, 60)}...`);
        
        const result = await this._generateSingleImage(
          promptText,
          {
            aspectRatio,
            quality,
            seed,
            model,
            index: i,
            ...promptSettings
          }
        );

        results.push({
          success: true,
          imagePath: result.imagePath,
          prompt: promptText,
          index: i,
          metadata: result.metadata,
        });

        console.log(`   ✅ Image ${i + 1} generated successfully`);
      } catch (error) {
        console.error(`   ❌ Failed to generate image ${i + 1}:`, error.message);
        results.push({
          success: false,
          imagePath: null,
          prompt: promptText,
          index: i,
          error: error.message,
        });
      }

      // Rate limiting: delay between requests
      if (i < prompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`\n✅ Generated ${successCount}/${prompts.length} images successfully`);

    return results;
  }

  /**
   * Generate a single image using Fal.AI REST API
   * @private
   */
  async _generateSingleImage(prompt, options = {}) {
    const {
      aspectRatio = '16:9',
      quality = 'standard',
      seed = null,
      model = 'dev',
      index = 0,
    } = options;

    const startTime = Date.now();
    const modelEndpoint = model === 'pro' ? 
      'https://fal.run/fal-ai/flux-pro' :
      'https://fal.run/fal-ai/flux/dev';
    
    try {
      // Make API request to Fal.AI
      const requestBody = {
        prompt: prompt,
        image_size: ASPECT_RATIO_MAP[aspectRatio] || 'landscape_16_9',
        num_inference_steps: quality === 'hd' ? 50 : 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
      };

      if (seed) {
        requestBody.seed = seed;
      }

      const response = await axios.post(modelEndpoint, requestBody, {
        headers: {
          'Authorization': `Key ${this.falAIConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 180000, // 3 minutes
      });

      const processingTime = Date.now() - startTime;

      // Get image URL from result
      if (!response.data.images || response.data.images.length === 0) {
        throw new Error('No images in Fal.AI response');
      }

      const imageData = response.data.images[0];
      const imageUrl = imageData.url;

      // Download image
      const imagePath = await this._downloadImage(imageUrl, index);

      return {
        imagePath,
        imageUrl,
        metadata: {
          prompt,
          width: imageData.width,
          height: imageData.height,
          model: modelEndpoint,
          seed: response.data.seed || seed,
          aspectRatio,
          quality,
          processingTime,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      // Enhanced error handling
      if (error.response) {
        const errorData = error.response.data;
        if (errorData.detail && errorData.detail.includes('balance')) {
          throw new Error('Fal.AI account has no balance. Add credits at https://fal.ai/dashboard/billing');
        }
        if (errorData.detail && errorData.detail.includes('locked')) {
          throw new Error('Fal.AI account locked. Check https://fal.ai/dashboard/billing');
        }
        throw new Error(`Fal.AI API error (${error.response.status}): ${JSON.stringify(errorData)}`);
      }
      throw error;
    }
  }

  /**
   * Download image from URL
   * @private
   */
  async _downloadImage(url, index) {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const timestamp = Date.now();
    const filename = `image_${timestamp}_${index}.png`;
    const filepath = path.join(paths.temp, filename);
    
    await fs.ensureDir(path.dirname(filepath));
    await fs.writeFile(filepath, response.data);

    return filepath;
  }

  /**
   * Animate an image (image-to-video)
   * Optional feature for later implementation
   */
  async animateImage(imagePath, duration = 3) {
    console.log(`🎬 Animating image for ${duration} seconds...`);
    console.log(`   ⚠️  Image animation not yet implemented`);

    throw new Error('Image animation not yet implemented. Coming soon!');
  }

  /**
   * Validate image file
   */
  async validateImage(imagePath) {
    try {
      const stats = await fs.stat(imagePath);
      const buffer = await fs.readFile(imagePath);

      const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8;
      const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50;
      const isWebP = buffer[8] === 0x57 && buffer[9] === 0x45;

      const isValid = isJPEG || isPNG || isWebP;
      const format = isJPEG ? 'JPEG' : isPNG ? 'PNG' : isWebP ? 'WebP' : 'Unknown';

      return {
        isValid,
        format,
        fileSize: stats.size,
        filePath: imagePath,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
      };
    }
  }

  /**
   * Test image generation API
   */
  async testImageGeneration() {
    console.log('\n🧪 Testing Fal.AI Image Generation...\n');

    const testPrompt = "A majestic mountain landscape at sunset, high quality, detailed";

    try {
      const startTime = Date.now();
      
      const results = await this.generateImages([testPrompt], {
        aspectRatio: '16:9',
        quality: 'standard',
        model: 'dev',
      });

      const processingTime = Date.now() - startTime;

      if (results[0].success) {
        console.log('✅ Image generation test passed');
        console.log(`   Time: ${processingTime}ms`);
        console.log(`   File: ${results[0].imagePath}`);
        
        const stats = await fs.stat(results[0].imagePath);
        console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);

        return {
          success: true,
          time: processingTime,
          imagePath: results[0].imagePath,
          metadata: results[0].metadata,
        };
      } else {
        throw new Error(results[0].error);
      }
    } catch (error) {
      console.log('❌ Image generation test failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = ImageService;
