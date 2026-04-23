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

let client = null;

function getClient() {
  if (client) return client;
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error('ASSEMBLYAI_API_KEY not configured');
  client = new AssemblyAI({ apiKey });
  return client;
}

function isConfigured() {
  return !!process.env.ASSEMBLYAI_API_KEY;
}

/**
 * Transcribe audio (URL or local path) and return word-level timestamps.
 * Returns { words: [{text, start, end}] } with ms timestamps.
 */
async function transcribeWords(audioUrlOrPath, { language = null } = {}) {
  const c = getClient();
  const transcript = await c.transcripts.transcribe({
    audio: audioUrlOrPath,
    speech_model: 'best',
    punctuate: true,
    format_text: true,
    // Let language auto-detect unless explicitly pinned.
    ...(language ? { language_code: language } : { language_detection: true }),
  });

  if (transcript.status === 'error') {
    throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
  }

  const words = (transcript.words || []).map((w) => ({
    text: w.text,
    start: w.start, // ms
    end: w.end,     // ms
  }));

  return {
    transcriptId: transcript.id,
    text: transcript.text,
    words,
    audioDurationSeconds: transcript.audio_duration,
  };
}

module.exports = { isConfigured, transcribeWords };
