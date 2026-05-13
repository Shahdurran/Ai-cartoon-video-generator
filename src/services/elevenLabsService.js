/**
 * ElevenLabs voice service.
 *
 * Thin wrapper around the official `elevenlabs` npm package. Exposes a
 * listVoices() helper for the Next.js voice picker and generateAudio()
 * for the voice queue processor.
 *
 * Env:  ELEVENLABS_API_KEY
 */

require('dotenv').config();
const axios = require('axios');

let ElevenLabsClient;
try {
  ({ ElevenLabsClient } = require('elevenlabs'));
} catch (err) {
  console.warn('⚠️  elevenlabs package not installed -- voiceover will fail until npm install');
}

let client = null;

function getClient() {
  if (client) return client;
  if (!ElevenLabsClient) throw new Error('elevenlabs package not available');
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured');
  client = new ElevenLabsClient({ apiKey });
  return client;
}

function isConfigured() {
  return !!process.env.ELEVENLABS_API_KEY && !!ElevenLabsClient;
}

async function listVoices() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured');
  const baseUrl = process.env.ELEVENLABS_API_BASE_URL || 'https://api.elevenlabs.io';

  /** De-dupe by `voice_id` while paging — some edge responses can overlap. */
  const byId = new Map();
  let nextPageToken = null;
  const MAX_PAGES = 50;
  const PAGE_SIZE = 100;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams();
    params.set('page_size', String(PAGE_SIZE));
    params.set('show_legacy', 'true');
    if (nextPageToken) params.set('next_page_token', nextPageToken);

    const url = `${baseUrl.replace(/\/$/, '')}/v1/voices?${params.toString()}`;
    const res = await axios.get(url, {
      headers: {
        'xi-api-key': apiKey,
        Accept: 'application/json',
      },
      timeout: 30_000,
    });
    const chunk = Array.isArray(res.data?.voices) ? res.data.voices : [];
    for (const v of chunk) {
      const id = v?.voice_id;
      if (id && !byId.has(id)) byId.set(id, v);
    }

    const hasMore = Boolean(res.data?.has_more);
    nextPageToken = res.data?.next_page_token || null;
    // Official pattern: stop when the API says there is no next page.
    if (!hasMore) break;
    if (!nextPageToken) {
      console.warn(
        '[elevenLabs] listVoices: has_more is true but next_page_token is missing; stopping pagination'
      );
      break;
    }
  }

  const voices = [...byId.values()];
  return voices.map((v) => ({
    voiceId: v.voice_id,
    name: v.name,
    previewUrl: v.preview_url || null,
    category: v.category || null,
    labels: v.labels || {},
    description: v.description || null,
  }));
}

/**
 * Generate audio for the given text. Returns a Node Buffer so the caller
 * can decide whether to upload to R2 or write to disk.
 */
async function generateAudio(voiceId, text, settings = {}) {
  if (!voiceId) throw new Error('voiceId is required');
  if (!text) throw new Error('text is required');

  const c = getClient();
  const {
    modelId = 'eleven_multilingual_v2',
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0,
    useSpeakerBoost = true,
    speed = 1.0,
  } = settings;

  // The SDK returns an async iterable of Uint8Array chunks.
  const stream = await c.textToSpeech.convert(voiceId, {
    text,
    model_id: modelId,
    voice_settings: {
      stability,
      similarity_boost: similarityBoost,
      style,
      use_speaker_boost: useSpeakerBoost,
      speed,
    },
    output_format: 'mp3_44100_128',
  });

  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

module.exports = { isConfigured, listVoices, generateAudio };
