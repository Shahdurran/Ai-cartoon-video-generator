/**
 * Cartoon voice controller -- exposes ElevenLabs voice list for the
 * cartoon Next.js UI.
 *
 * Routes:
 *   GET /api/voices       -- list ElevenLabs voices
 */

const elevenLabs = require('../services/elevenLabsService');

async function list(req, res, next) {
  try {
    if (!elevenLabs.isConfigured()) {
      return res.status(503).json({
        error: 'ElevenLabs not configured. Set ELEVENLABS_API_KEY in the server .env and restart.',
        voices: [],
      });
    }
    const voices = await elevenLabs.listVoices();
    res.json({ voices });
  } catch (err) {
    // Surface auth/quota issues with a clean 503 + actionable copy instead of
    // leaking a stack trace to the UI.
    const msg = String(err?.message || '');
    const status = err?.statusCode || err?.status || 0;
    const looksUnauthorized =
      status === 401 ||
      /401|invalid_api_key|invalid api key|unauthorized/i.test(msg);
    const looksRateLimited = status === 429 || /429|rate.?limit/i.test(msg);

    if (looksUnauthorized) {
      return res.status(503).json({
        error:
          'ElevenLabs rejected the API key. The current ELEVENLABS_API_KEY is invalid, revoked, or missing the "voices_read" permission. Generate a new key at https://elevenlabs.io/app/settings/api-keys, paste it into the server .env, and restart.',
        voices: [],
      });
    }
    if (looksRateLimited) {
      return res.status(503).json({
        error: 'ElevenLabs rate limit hit. Wait ~30s and refresh.',
        voices: [],
      });
    }
    return next(err);
  }
}

module.exports = { list };
