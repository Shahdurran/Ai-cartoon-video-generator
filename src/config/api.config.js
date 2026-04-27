const path = require('path');
const { normalizeEnvString } = require('../utils/envString');

require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

/**
 * API Configuration
 * Centralized configuration for all external API integrations
 */

// Anthropic accepts the official name only in docs, but people sometimes
// use shorter aliases in .env — resolve them here so the SDK always gets
// a concrete apiKey or fails loudly with setup instructions.
const anthropicApiKey = normalizeEnvString(
  process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_KEY ||
    process.env.CLAUDE_API_KEY
);

const assemblyAiKey =
  normalizeEnvString(process.env.ASSEMBLYAI_API_KEY) ||
  normalizeEnvString(process.env.ASSEMBLY_AI_API_KEY);

const apiConfig = {
  // Claude API Configuration (Anthropic)
  claude: {
    apiKey: anthropicApiKey,
    model: 'claude-sonnet-4-5-20250929', // Claude Sonnet 4.5 (latest)
    maxTokens: 4096,
    temperature: 0.7,
    // Note: @anthropic-ai/sdk handles the base URL internally
  },

  // AssemblyAI Configuration (Transcription)
  assemblyAI: {
    apiKey: assemblyAiKey,
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
if (!anthropicApiKey) {
  console.warn(
    '⚠️  Warning: ANTHROPIC_API_KEY (or ANTHROPIC_KEY / CLAUDE_API_KEY) not set. Claude / scene script features will not work.'
  );
}

if (!assemblyAiKey) {
  console.warn(
    '⚠️  Warning: ASSEMBLYAI_API_KEY (or ASSEMBLY_AI_API_KEY) not set in the repo-root .env. AssemblyAI / cartoon subtitles will not work.'
  );
}

const requiredKeys = {
  FAL_AI_API_KEY: 'Fal.AI',
  GENAIPRO_API_KEY: 'Genaipro.vn',
};

Object.entries(requiredKeys).forEach(([envKey, serviceName]) => {
  if (!process.env[envKey]) {
    console.warn(`⚠️  Warning: ${envKey} not set. ${serviceName} features will not work.`);
  }
});

module.exports = apiConfig;

