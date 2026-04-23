require('dotenv').config();

/**
 * API Configuration
 * Centralized configuration for all external API integrations
 */

const apiConfig = {
  // Claude API Configuration (Anthropic)
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-5-20250929', // Claude Sonnet 4.5 (latest)
    maxTokens: 4096,
    temperature: 0.7,
    // Note: @anthropic-ai/sdk handles the base URL internally
  },

  // AssemblyAI Configuration (Transcription)
  assemblyAI: {
    apiKey: process.env.ASSEMBLYAI_API_KEY,
    baseURL: 'https://api.assemblyai.com/v2',
    timeout: 300000, // 5 minutes
  },

  // Fal.AI Configuration (Image Generation & Voice Fallback)
  falAI: {
    apiKey: process.env.FAL_AI_API_KEY,
    baseURL: 'https://fal.run',
    endpoints: {
      imageGeneration: '/fal-ai/flux/dev',
      voiceGeneration: '/fal-ai/voice',
    },
    timeout: 120000, // 2 minutes
  },

  // Genaipro.vn Configuration (Primary Voice Generation - Task-based API)
  genaipro: {
    apiKey: process.env.GENAIPRO_API_KEY,
    baseURL: 'https://genaipro.vn/api/v1',
    endpoints: {
      createTask: '/labs/task',
      getTask: '/labs/task', // GET /labs/task/:task_id
      listTasks: '/labs/task',
      deleteTask: '/labs/task', // DELETE /labs/task/:task_id
      voiceClones: '/max/voice-clones', // Voice cloning endpoints
    },
    timeout: 30000, // 30 seconds for API calls
    taskPollInterval: 3000, // 3 seconds between status checks
    taskMaxWaitTime: 300000, // 5 minutes max wait for task completion (voice clones can take longer)
    defaultVoiceId: '8r85BR6Y359RwfMPGrOJ', // Michael Reimer - Clone (American Male, Professional)
    defaultModelId: 'eleven_turbo_v2_5', // Fast and good quality
    defaultSpeed: 1.0,
    defaultStyle: 0.0,
    defaultSimilarity: 0.75,
    defaultStability: 0.5,
    defaultUseSpeakerBoost: true,
  },

  // Google Fonts Configuration (Optional)
  googleFonts: {
    apiKey: process.env.GOOGLE_FONTS_API_KEY,
    baseURL: 'https://www.googleapis.com/webfonts/v1',
  },

  // Request timeouts (ms)
  timeouts: {
    script: 60000, // 1 minute
    image: 120000, // 2 minutes
    voice: 120000, // 2 minutes
    video: 1800000, // 30 minutes
    transcription: 300000, // 5 minutes
  },

  // Retry configuration
  retry: {
    attempts: 3,
    delay: 5000, // 5 seconds
    factor: 2, // Exponential backoff factor
  },
};

// Validation: Warn if required API keys are missing
const requiredKeys = {
  ANTHROPIC_API_KEY: 'Claude API',
  FAL_AI_API_KEY: 'Fal.AI',
  GENAIPRO_API_KEY: 'Genaipro.vn',
  ASSEMBLYAI_API_KEY: 'AssemblyAI',
};

Object.entries(requiredKeys).forEach(([envKey, serviceName]) => {
  if (!process.env[envKey]) {
    console.warn(`⚠️  Warning: ${envKey} not set. ${serviceName} features will not work.`);
  }
});

module.exports = apiConfig;

