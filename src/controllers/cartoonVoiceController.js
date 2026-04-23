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
        error: 'ElevenLabs not configured. Set ELEVENLABS_API_KEY.',
        voices: [],
      });
    }
    const voices = await elevenLabs.listVoices();
    res.json({ voices });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
