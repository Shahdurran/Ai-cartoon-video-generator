/**
 * Cartoon music controller -- thin wrapper around musicTrackRepo for the
 * HTTP handlers for `/api/music` (used by the Next.js app).
 *
 * Routes:
 *   GET /api/music
 *   GET /api/music/:id
 *   POST /api/music/upload (multipart: file)
 */

const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const musicTrackRepo = require('../db/repositories/musicTrackRepo');
const r2Service = require('../services/r2Service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
});

const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']);
const AUDIO_MIME_HINTS = ['audio/', 'application/ogg'];

function sanitizeBaseName(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'track';
}

function detectAudioExt(file) {
  const fromName = path.extname(file?.originalname || '').toLowerCase();
  if (AUDIO_EXTS.has(fromName)) return fromName;

  const mime = String(file?.mimetype || '').toLowerCase();
  if (mime.includes('mpeg') || mime.includes('mp3')) return '.mp3';
  if (mime.includes('wav') || mime.includes('wave')) return '.wav';
  if (mime.includes('mp4') || mime.includes('m4a')) return '.m4a';
  if (mime.includes('aac')) return '.aac';
  if (mime.includes('ogg')) return '.ogg';
  if (mime.includes('flac')) return '.flac';
  return null;
}

function isLikelyAudio(file) {
  const ext = detectAudioExt(file);
  if (ext) return true;
  const mime = String(file?.mimetype || '').toLowerCase();
  return AUDIO_MIME_HINTS.some((h) => mime.startsWith(h));
}

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

async function uploadTrack(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required (field: file)' });
    }
    if (!isLikelyAudio(req.file)) {
      return res.status(400).json({
        error: 'Unsupported file type. Upload an audio file (.mp3, .wav, .m4a, .aac, .ogg, .flac).',
      });
    }

    const ext = detectAudioExt(req.file) || '.mp3';
    const base = sanitizeBaseName(req.body?.name || req.file.originalname);
    const stamp = Date.now();
    const storedFilename = `${base}-${stamp}${ext}`;
    const r2Key = r2Service.keys.musicTrack(storedFilename);
    const contentType = req.file.mimetype || r2Service.guessContentType(req.file.originalname || ext);

    if (r2Service.isConfigured()) {
      await r2Service.upload(r2Key, req.file.buffer, contentType);
    } else {
      const musicDir = path.resolve(__dirname, '..', '..', 'music-library');
      await fs.ensureDir(musicDir);
      await fs.writeFile(path.join(musicDir, storedFilename), req.file.buffer);
    }

    const created = await musicTrackRepo.create({
      name: String(req.body?.name || req.file.originalname || 'Uploaded track')
        .replace(/\.[^.]+$/, '')
        .trim()
        .slice(0, 200),
      r2Key,
      durationSeconds: null,
      tags: [],
    });

    res.status(201).json({ track: await hydrate(created) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, get, upload, uploadTrack };
