/**
 * Cartoon-specific AssemblyAI wrapper.
 *
 * The existing src/services/assemblyAIService.js focuses on file-path input
 * and returns a pre-generated SRT string. For the cartoon pipeline we want
 * to:
 *   1. Submit a REMOTE audio URL (e.g. R2 signed URL).
 *   2. Get raw word-level timestamps back so we can control formatting.
 *
 * The formatter lives in srtService.
 */

const { AssemblyAI } = require('assemblyai');
const apiConfig = require('../config/api.config');

let client = null;
let cachedApiKey = null;

function getClient() {
  const apiKey = apiConfig.assemblyAI.apiKey;
  if (!apiKey) throw new Error('ASSEMBLYAI_API_KEY not configured');
  if (!client || cachedApiKey !== apiKey) {
    client = new AssemblyAI({ apiKey });
    cachedApiKey = apiKey;
  }
  return client;
}

function isConfigured() {
  return !!apiConfig.assemblyAI.apiKey;
}

/**
 * Transcribe audio (URL or local path) and return word-level timestamps.
 * Returns { words: [{text, start, end}] } with ms timestamps.
 */
async function transcribeWords(audioUrlOrPath, { language = null } = {}) {
  const c = getClient();
  // The SDK migrated from `speech_model` (singular, with values 'best'/'nano')
  // to `speech_models` (plural, with values like 'universal-3-pro' /
  // 'universal-2'). Listing both lets U3 Pro handle the 6 supported
  // languages and falls back to U2 for everything else.
  const params = {
    audio: audioUrlOrPath,
    speech_models: ['universal-3-pro', 'universal-2'],
    punctuate: true,
    format_text: true,
    ...(language ? { language_code: language } : { language_detection: true }),
  };
  console.log(
    `🎧 [assemblyai] transcribe url=${typeof audioUrlOrPath === 'string' ? audioUrlOrPath.slice(0, 80) + (audioUrlOrPath.length > 80 ? '…' : '') : '[buffer]'}`
  );
  let transcript;
  try {
    transcript = await c.transcripts.transcribe(params);
  } catch (err) {
    // AssemblyAI rejects with descriptive messages we want to see end-to-end
    // (deprecation, auth, quota); re-throw with a labeled prefix.
    throw new Error(`AssemblyAI request failed: ${err.message}`);
  }

  if (transcript.status === 'error') {
    throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
  }

  const words = (transcript.words || []).map((w) => ({
    text: w.text,
    start: w.start, // ms
    end: w.end,     // ms
  }));

  console.log(
    `✅ [assemblyai] transcript ${transcript.id} status=${transcript.status} words=${words.length} duration=${transcript.audio_duration}s model=${transcript.speech_model || 'auto'}`
  );

  return {
    transcriptId: transcript.id,
    text: transcript.text,
    words,
    audioDurationSeconds: transcript.audio_duration,
  };
}

module.exports = { isConfigured, transcribeWords };
