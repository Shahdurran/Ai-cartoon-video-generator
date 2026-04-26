/**
 * Style controller. Read-only for v1.
 *
 * Routes:
 *   GET /api/styles
 *   GET /api/styles/:id
 */

const styleRepo = require('../db/repositories/styleRepo');
const r2Service = require('../services/r2Service');

async function hydrate(style) {
  if (!style) return style;
  let thumbnailUrl = null;
  if (style.thumbnailKey && r2Service.isConfigured()) {
    // Style thumbnails are seeded by the user (not generated on demand), so
    // they're often missing in fresh dev environments. Verify the object
    // exists before handing the UI a URL that would 404.
    try {
      const present = await r2Service.exists(style.thumbnailKey);
      if (present) {
        thumbnailUrl =
          r2Service.publicUrl(style.thumbnailKey) ||
          (await r2Service.getSignedDownloadUrl(style.thumbnailKey).catch(() => null));
      }
    } catch (_) {
      thumbnailUrl = null;
    }
  }
  return { ...style, thumbnailUrl };
}

async function list(req, res, next) {
  try {
    const styles = await styleRepo.list();
    const hydrated = await Promise.all(styles.map(hydrate));
    res.json({ styles: hydrated });
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    const style = await styleRepo.findById(req.params.id);
    if (!style) return res.status(404).json({ error: 'Style not found' });
    res.json({ style: await hydrate(style) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, get };
