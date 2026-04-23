/**
 * Cartoon music controller -- thin wrapper around musicTrackRepo for the
 * new cartoon UI. The legacy /api/v2/music-library routes remain untouched.
 *
 * Routes:
 *   GET /api/music
 *   GET /api/music/:id
 */

const musicTrackRepo = require('../db/repositories/musicTrackRepo');
const r2Service = require('../services/r2Service');

async function hydrate(track) {
  if (!track) return track;
  let previewUrl = null;
  if (track.r2Key) {
    if (r2Service.isConfigured()) {
      try { previewUrl = await r2Service.getSignedDownloadUrl(track.r2Key); } catch (_) {}
    } else {
      previewUrl = `/music-library/${track.r2Key.replace(/^music-library\//, '')}`;
    }
  }
  return { ...track, previewUrl };
}

async function list(req, res, next) {
  try {
    const tracks = await musicTrackRepo.list();
    res.json({ tracks: await Promise.all(tracks.map(hydrate)) });
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    const track = await musicTrackRepo.findById(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    res.json({ track: await hydrate(track) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, get };
