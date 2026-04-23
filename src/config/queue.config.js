require('dotenv').config();

/**
 * Queue Configuration
 * Bull queue settings with Redis for job management
 */

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const queueConfig = {
  redis: redisConfig,
  
  // Default job options
  defaultJobOptions: {
    attempts: parseInt(process.env.QUEUE_JOB_ATTEMPTS || '3', 10),
    timeout: parseInt(process.env.QUEUE_JOB_TIMEOUT || '300000', 10), // 5 minutes default
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      count: 200, // Keep last 200 failed jobs
    },
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 seconds initial delay
    },
  },

  // Queue settings
  settings: {
    maxStalledCount: 2,
    stalledInterval: 30000, // Check for stalled jobs every 30 seconds
    guardInterval: 5000,
    retryProcessDelay: 5000,
  },

  // Limiter for rate limiting
  limiter: {
    max: parseInt(process.env.QUEUE_MAX_CONCURRENT_JOBS || '3', 10),
    duration: 1000, // per second
  },
};

// Queue names
const QUEUE_NAMES = {
  SCRIPT_GENERATION: 'script-generation',
  IMAGE_GENERATION: 'image-generation',
  VOICE_GENERATION: 'voice-generation',
  VIDEO_PROCESSING: 'video-processing',
  BATCH_PROCESSING: 'batch-processing',
  TRANSCRIPTION: 'transcription',
};

// Queue-specific concurrency settings
const QUEUE_CONCURRENCY = {
  SCRIPT_GENERATION: parseInt(process.env.QUEUE_SCRIPT_CONCURRENCY || '3', 10),
  IMAGE_GENERATION: parseInt(process.env.QUEUE_IMAGE_CONCURRENCY || '2', 10),
  VOICE_GENERATION: parseInt(process.env.QUEUE_VOICE_CONCURRENCY || '2', 10),
  VIDEO_PROCESSING: parseInt(process.env.QUEUE_VIDEO_CONCURRENCY || '1', 10),
  BATCH_PROCESSING: 1, // Always 1 for batch processing
  TRANSCRIPTION: parseInt(process.env.QUEUE_VOICE_CONCURRENCY || '2', 10),
};

// Job priorities
const JOB_PRIORITIES = {
  LOW: 1,
  NORMAL: 5,
  HIGH: 10,
  URGENT: 20,
};

// Job status
const JOB_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed',
  PAUSED: 'paused',
  STUCK: 'stuck',
};

// Job timeout configurations by type (milliseconds)
const JOB_TIMEOUTS = {
  SCRIPT_GENERATION: 60000, // 1 minute
  IMAGE_GENERATION: 180000, // 3 minutes
  VOICE_GENERATION: 120000, // 2 minutes
  VIDEO_PROCESSING: 1800000, // 30 minutes
  BATCH_PROCESSING: 7200000, // 2 hours
  TRANSCRIPTION: 300000, // 5 minutes
};

// Retry strategies by queue type
const RETRY_STRATEGIES = {
  SCRIPT_GENERATION: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
  IMAGE_GENERATION: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
  },
  VOICE_GENERATION: {
    attempts: 1, // Don't retry voice generation to prevent cascading failures
    backoff: { type: 'fixed', delay: 0 },
  },
  VIDEO_PROCESSING: {
    attempts: 2, // Video processing is resource-intensive
    backoff: { type: 'exponential', delay: 30000 },
  },
  BATCH_PROCESSING: {
    attempts: 1, // Don't retry batches automatically
    backoff: { type: 'fixed', delay: 0 },
  },
  TRANSCRIPTION: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
  },
};

module.exports = {
  redisConfig,
  queueConfig,
  QUEUE_NAMES,
  QUEUE_CONCURRENCY,
  JOB_PRIORITIES,
  JOB_STATUS,
  JOB_TIMEOUTS,
  RETRY_STRATEGIES,
};

