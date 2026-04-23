const path = require('path');

module.exports = {
  PORT: 3000,
  TEMP_DIR: path.join(__dirname, '../../temp'),
  PUBLIC_DIR: path.join(__dirname, '../../public'),
  TEST_OUTPUT_DIR: path.join(__dirname, '../../test-output'),
  VIDEOS_DIR: path.join(__dirname, '../../public/videos'),
  EFFECTS_DIR: path.join(__dirname, '../../public/effects'),
  
  // Whisper configuration
  WHISPER_CONFIG: {
    MODEL_SIZE: 'tiny',
    CHUNK_DURATION: 300, // 5 minutes per chunk
    TIMEOUT_PER_CHUNK: 300000, // 5 minutes per chunk
    SAMPLE_RATE: 16000,
    CHANNELS: 1,
    PARALLEL_CHUNKS: 2,
    MAX_CHARS_PER_LINE: 40,
    MIN_SEGMENT_DURATION: 1.0,
    MAX_SEGMENT_DURATION: 3.0
  },
  
  // Video configuration
  VIDEO_CONFIG: {
    MAX_DURATION: 45 * 60, // 45 minutes
    DEFAULT_WIDTH: 1920,
    DEFAULT_HEIGHT: 1080,
    DEFAULT_PARTICLE_OPACITY: 0.5
  }
}; 