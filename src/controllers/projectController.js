/**
 * Project controller -- REST API for the AI Cartoon Generator.
 *
 * Routes (mounted under /api/projects):
 *   POST   /                                                    -- create project + kick off script gen
 *   GET    /                                                    -- list
 *   GET    /:id                                                 -- hydrated project (+ scenes, images, hooks)
 *   PATCH  /:id                                                 -- update settings
 *   DELETE /:id                                                 -- cascade delete + R2 cleanup
 *
 *   PUT    /:id/scenes                                          -- bulk replace scene list (script-review)
 *   POST   /:id/regenerate-script                               -- re-run Claude script gen
 *   POST   /:id/approve-script                                  -- approve scenes; enqueue image jobs
 *
 *   PATCH  /:id/scenes/:sceneId/select-image                    -- choose a variant
 *   POST   /:id/scenes/:sceneId/regenerate-image                -- regenerate variants (optional new prompt)
 *   POST   /:id/scenes/:sceneId/upload-image                    -- multipart custom image (replaces variants)
 *   POST   /:id/scenes/:sceneId/insert-product-on-selected       -- product packshot → Kling O1 on selected frame (appends variants)
 *   POST   /:id/scenes/:sceneId/voice                           -- (re)generate voiceover for one scene
 *   POST   /:id/scenes/:sceneId/regenerate-video                -- re-run Seedance for one scene
 *   POST   /:id/subtitles                                       -- (re)generate project-wide subtitles
 *   POST   /:id/generate                                        -- kick off Seedance + assembly
 *   POST   /:id/hooks                                           -- enqueue hook generator
 *   GET    /:id/status/stream                                   -- SSE progress
 */

const path = require('path');
const multer = require('multer');

const projectRepo = require('../db/repositories/projectRepo');
const sceneRepo = require('../db/repositories/sceneRepo');
const sceneImageRepo = require('../db/repositories/sceneImageRepo');
const shotRepo = require('../db/repositories/shotRepo');
const styleRepo = require('../db/repositories/styleRepo');
const musicTrackRepo = require('../db/repositories/musicTrackRepo');
const hookVariantRepo = require('../db/repositories/hookVariantRepo');
const projectVisualReferenceRepo = require('../db/repositories/projectVisualReferenceRepo');
const { randomUUID } = require('crypto');

const r2Service = require('../services/r2Service');
const pubsub = require('../services/pubsubService');
const { queues } = require('../queues/cartoonQueues');

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/** Subtitle font uploads: small TTF/OTF only for libass / FFmpeg. */
const fontUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const n = (file.originalname || '').toLowerCase();
    if (n.endsWith('.ttf') || n.endsWith('.otf')) cb(null, true);
    else cb(new Error('Only .ttf and .otf font files are allowed'));
  },
});

// ------- helpers -------------------------------------------------------------

/**
 * Use `R2_PUBLIC_BASE_URL/<object-key>` for browser fetches when the public
 * dev URL (or custom domain) is set in .env — that is the usual Cloudflare
 * setup: copy the “Public URL” from the bucket and set R2_PUBLIC_BASE_URL.
 *
 * Set `R2_USE_PUBLIC_CDN=0` to always mint presigned GET URLs instead (same
 * bucket as the S3 API; use if the public URL 404s or points at another bucket).
 */
function preferPublicCdnUrls() {
  const optOut = process.env.R2_USE_PUBLIC_CDN;
  if (optOut === '0' || optOut === 'false' || optOut === 'no') {
    return false;
  }
  const base = process.env.R2_PUBLIC_BASE_URL;
  return !!(base && String(base).trim());
}

/**
 * Resolve a renderable URL for an R2 object.
 */
async function urlFor(key) {
  if (!key || !r2Service.isConfigured()) return null;
  if (preferPublicCdnUrls()) {
    const pub = r2Service.publicUrl(key);
    if (pub) return pub;
  }
  return r2Service.getSignedDownloadUrl(key).catch(() => null);
}

/**
 * Map a browser-uploaded image mime to the canonical file extension we
 * use when keying objects on R2. Falls back to png so the bucket key is
 * always something we can serve.
 */
function imageExtFromMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  return 'png';
}

async function hydrateImageVariants(images) {
  return Promise.all(
    images.map(async (img) => ({
      ...img,
      signedUrl: await urlFor(img.r2Key),
    }))
  );
}

async function hydrateProjectDetailed(project) {
  if (!project) return null;

  const [scenes, hookVariants] = await Promise.all([
    sceneRepo.findByProject(project.id),
    hookVariantRepo.listByProject(project.id),
  ]);

  const fullScenes = await Promise.all(
    scenes.map(async (scene) => {
      const images = await sceneImageRepo.findByScene(scene.id);
      const shots = scene.multiShotEnabled
        ? await shotRepo.findByScene(scene.id)
        : [];
      const shotsHydrated = await Promise.all(
        shots.map(async (shot) => {
          const variants = await sceneImageRepo.findByShot(shot.id);
          return {
            ...shot,
            imageVariants: await hydrateImageVariants(variants),
            videoSignedUrl: await urlFor(shot.videoKey),
          };
        })
      );
      return {
        ...scene,
        imageVariants: await hydrateImageVariants(images),
        voiceSignedUrl: await urlFor(scene.voiceKey),
        videoSignedUrl: await urlFor(scene.videoKey),
        productReferenceSignedUrl: await urlFor(scene.productReferenceKey),
        shots: shotsHydrated,
      };
    })
  );

  const hydratedHooks = await Promise.all(
    hookVariants.map(async (h) => ({
      ...h,
      outputSignedUrl: await urlFor(h.outputKey),
    }))
  );

  const outputSignedUrl = await urlFor(project.outputKey);
  const subtitlesSignedUrl = await urlFor(project.subtitlesKey);
  const subtitleCustomFontSignedUrl = await urlFor(
    project.subtitleSettings?.customFontKey
  );

  const visualReferences = await projectVisualReferenceRepo.findByProject(project.id);
  const visualReferencesHydrated = await Promise.all(
    visualReferences.map(async (ref) => ({
      ...ref,
      signedUrl: await urlFor(ref.r2Key),
    }))
  );

  return {
    ...project,
    scenes: fullScenes,
    hookVariants: hydratedHooks,
    visualReferences: visualReferencesHydrated,
    outputSignedUrl,
    subtitlesSignedUrl,
    subtitleCustomFontSignedUrl,
  };
}

// ------- routes --------------------------------------------------------------

async function create(req, res, next) {
  try {
    const {
      topic,
      sourceScript,
      styleId,
      sceneCount = 5,
      voiceId,
      voiceSettings = {},
      subtitleSettings = {},
      imageModelSettings = {},
      videoModelSettings = {},
      musicTrackId,
      musicVolume = 0.15,
      totalDurationSeconds = null,
      language = 'English',
      tone = 'dramatic',
      visualNotes = null,
      // Pre-uploaded reference image keys (returned by
      // POST /visual-references/upload). The frontend collects them as
      // the user picks files in step 1, then sends the keys with the
      // create body. We move them into the project's prefix here and
      // persist a project_visual_references row per image.
      visualReferenceKeys = [],
    } = req.body;

    if (!topic && !sourceScript) {
      return res.status(400).json({ error: 'Either topic or sourceScript is required' });
    }

    // styleId is optional, but the user MUST give us something to anchor
    // the visuals on: a style preset OR at least one reference image OR
    // some free-text visual direction. Otherwise Claude has nothing to
    // ground the look in and Flux/Nano-Banana have no character reference.
    const hasVisualNotes =
      typeof visualNotes === 'string' && visualNotes.trim().length > 0;
    const hasVisualRefKeys =
      Array.isArray(visualReferenceKeys) && visualReferenceKeys.length > 0;
    if (!styleId && !hasVisualNotes && !hasVisualRefKeys) {
      return res.status(400).json({
        error:
          'Pick a style OR provide visual direction (a reference image or visual notes) before generating.',
      });
    }

    if (styleId) {
      const style = await styleRepo.findById(styleId);
      if (!style) return res.status(400).json({ error: `Unknown styleId: ${styleId}` });
    }

    if (musicTrackId) {
      const track = await musicTrackRepo.findById(musicTrackId);
      if (!track) return res.status(400).json({ error: `Unknown musicTrackId: ${musicTrackId}` });
    }

    if (visualReferenceKeys && !Array.isArray(visualReferenceKeys)) {
      return res
        .status(400)
        .json({ error: 'visualReferenceKeys must be an array of staged R2 keys' });
    }
    // Defensive: only allow keys we minted ourselves. The temp upload
    // endpoint always writes under `temp/visual-references/`, so we
    // refuse anything else to keep callers from copying arbitrary
    // bucket objects into a project.
    for (const k of visualReferenceKeys) {
      if (typeof k !== 'string' || !k.startsWith('temp/visual-references/')) {
        return res
          .status(400)
          .json({ error: `Unrecognised reference key: ${k}` });
      }
    }

    const project = await projectRepo.create({
      topic, sourceScript, styleId, sceneCount,
      voiceId, voiceSettings, subtitleSettings,
      imageModelSettings, videoModelSettings,
      musicTrackId, musicVolume,
      visualNotes,
    });

    // Move every staged reference to a stable per-project key so the
    // temp objects can be safely cleaned up out-of-band. We keep the
    // mime type the temp upload recorded so Claude vision calls get
    // the right Content-Type later.
    if (visualReferenceKeys.length > 0 && r2Service.isConfigured()) {
      const refRows = [];
      for (let i = 0; i < visualReferenceKeys.length; i++) {
        const tempKey = visualReferenceKeys[i];
        const extMatch = tempKey.match(/\.([a-z0-9]+)$/i);
        const ext = (extMatch ? extMatch[1] : 'png').toLowerCase();
        const refId = randomUUID();
        const dstKey = `projects/${project.id}/visual-references/${refId}.${ext}`;
        try {
          await r2Service.copy(tempKey, dstKey);
          await r2Service.del(tempKey).catch(() => {});
          refRows.push({
            r2Key: dstKey,
            sortIndex: i,
            mimeType: r2Service.guessContentType(`f.${ext}`),
          });
        } catch (err) {
          console.warn(`[create] Failed to attach visual reference ${tempKey}: ${err.message}`);
        }
      }
      if (refRows.length > 0) {
        await projectVisualReferenceRepo.bulkCreate(project.id, refRows);
      }
    }

    await queues.sceneScript.add('generate', {
      projectId: project.id,
      input: sourceScript || topic,
      mode: sourceScript ? 'rewrite' : 'topic',
      sceneCount,
      styleId,
      totalDurationSeconds,
      language,
      tone,
      multiShotTargetSeconds: Number(project.multiShotTargetSeconds) || 2.5,
    });

    // Re-fetch so the response carries visualNotes + freshly-hydrated
    // visualReferences (with signed URLs).
    const hydrated = await hydrateProjectDetailed(
      await projectRepo.findById(project.id)
    );
    res.status(201).json({ project: hydrated });
  } catch (err) {
    next(err);
  }
}

/**
 * Temporary upload landing for visual reference images on the New Project
 * page. The frontend calls this BEFORE the project exists -- multipart
 * with one or more `images[]` files. We write each to
 * `temp/visual-references/<uuid>.<ext>` and return the stable R2 keys
 * (plus signed preview URLs) so the user can preview thumbnails and so
 * the create handler can later move them into the project's prefix.
 *
 *   POST /api/visual-references/upload  (multipart, field name: images)
 *
 * Anything left under `temp/visual-references/` that is never finalised
 * is safe to garbage-collect periodically (out of scope here).
 */
async function uploadVisualReferences(req, res, next) {
  try {
    const files = (req.files || []).filter((f) => !!f);
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    if (!r2Service.isConfigured()) {
      return res.status(503).json({ error: 'Object storage is not configured' });
    }
    const MAX_BYTES = 8 * 1024 * 1024;
    for (const f of files) {
      const mime = String(f.mimetype || '').toLowerCase();
      if (!mime.startsWith('image/')) {
        return res.status(400).json({ error: `Not an image: ${f.originalname}` });
      }
      if (f.size > MAX_BYTES) {
        return res.status(400).json({
          error: `Image too large (${f.originalname}). Max 8MB per reference.`,
        });
      }
    }

    const uploaded = [];
    for (const f of files) {
      const ext = imageExtFromMime(f.mimetype);
      const tempKey = `temp/visual-references/${randomUUID()}.${ext}`;
      await r2Service.upload(tempKey, f.buffer, f.mimetype || 'image/png');
      uploaded.push({
        tempKey,
        signedUrl: await urlFor(tempKey),
        originalName: f.originalname || null,
        mimeType: f.mimetype || null,
        sizeBytes: f.size,
      });
    }

    res.json({ uploaded });
  } catch (err) {
    next(err);
  }
}

/**
 * Detach (and delete) one visual reference from a project. Only valid
 * before the script has been approved -- once Claude has authored scenes
 * the references have already shaped the imagePrompts, so removing them
 * after that point would be misleading.
 *
 *   DELETE /api/projects/:id/visual-references/:refId
 */
async function deleteVisualReference(req, res, next) {
  try {
    const { id: projectId, refId } = req.params;
    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const lockedStates = new Set([
      'generating',
      'assembling',
      'complete',
    ]);
    if (lockedStates.has(project.status)) {
      return res.status(409).json({
        error: `Cannot edit visual references when project status is '${project.status}'`,
      });
    }

    const ref = await projectVisualReferenceRepo.findById(refId);
    if (!ref || ref.projectId !== projectId) {
      return res.status(404).json({ error: 'Visual reference not found' });
    }

    if (ref.r2Key && r2Service.isConfigured()) {
      r2Service.del(ref.r2Key).catch(() => {});
    }
    await projectVisualReferenceRepo.remove(refId);
    res.json({ removed: refId });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const limit = Math.min(200, parseInt(req.query.limit || '50', 10));
    const offset = parseInt(req.query.offset || '0', 10);
    // listWithProgress joins scene-level counters so the home page can
    // render "Generating 3/8 images" badges without an N+1 fetch.
    const projects = await projectRepo.listWithProgress({ limit, offset });
    res.json({ projects });
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    const project = await projectRepo.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const hydrated = await hydrateProjectDetailed(project);
    res.json({ project: hydrated });
  } catch (err) {
    next(err);
  }
}

async function patch(req, res, next) {
  try {
    const allowed = [
      'topic', 'sourceScript', 'styleId',
      'voiceId', 'voiceSettings', 'subtitleSettings',
      'imageModelSettings', 'videoModelSettings',
      'musicTrackId', 'musicVolume',
      'multiShotTargetSeconds',
    ];
    const patchBody = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patchBody[key] = req.body[key];
    }
    const project = await projectRepo.update(req.params.id, patchBody);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const project = await projectRepo.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Best-effort R2 cleanup under the project's key prefix.
    if (r2Service.isConfigured()) {
      try {
        await r2Service.deletePrefix(`projects/${project.id}/`);
      } catch (err) {
        console.warn('⚠️  R2 cleanup failed:', err.message);
      }
    }

    await projectRepo.remove(project.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function selectImage(req, res, next) {
  try {
    const { id: projectId, sceneId } = req.params;
    const { sceneImageId } = req.body;
    if (!sceneImageId) return res.status(400).json({ error: 'sceneImageId required' });

    const img = await sceneImageRepo.findById(sceneImageId);
    if (!img || img.sceneId !== sceneId) {
      return res.status(404).json({ error: 'Scene image not found for this scene' });
    }
    const scene = await sceneRepo.updateSelectedImage(sceneId, sceneImageId);
    res.json({ scene });
  } catch (err) {
    next(err);
  }
}

async function regenerateImage(req, res, next) {
  try {
    const { id: projectId, sceneId } = req.params;
    const { prompt, variantCount = 3 } = req.body;

    const scene = await sceneRepo.findById(sceneId);
    if (!scene || scene.projectId !== projectId) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const job = await queues.sceneImages.add('generate-variants', {
      projectId,
      sceneId,
      variantCount,
      clearExisting: true,
      customPrompt: prompt || null,
    });

    res.json({ enqueued: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
}

/**
 * Patch a single scene's editable fields (voiceoverText, imagePrompt,
 * durationSeconds) without touching its image variants, voice, or video.
 *
 * Used by the global Scenes drawer so the user can tweak narration / prompt
 * for one scene at a time after image generation has started. Allowed in
 * any state up to (but not including) video generation -- changing scene
 * length once Seedance is rendering would desync the timeline.
 *
 * Returns the updated scene with hydrated image / voice / video URLs.
 */
async function patchScene(req, res, next) {
  try {
    const { id: projectId, sceneId } = req.params;
    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const scene = await sceneRepo.findById(sceneId);
    if (!scene || scene.projectId !== projectId) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const lockedStates = new Set(['generating', 'assembling']);
    if (lockedStates.has(project.status)) {
      return res.status(409).json({
        error: `Cannot edit scene while project status is '${project.status}'`,
      });
    }

    const { imagePrompt, voiceoverText, durationSeconds } = req.body || {};
    const fields = {};
    if (typeof imagePrompt === 'string') fields.imagePrompt = imagePrompt.trim();
    if (typeof voiceoverText === 'string') fields.voiceoverText = voiceoverText.trim();
    if (durationSeconds != null) {
      const n = Number(durationSeconds);
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ error: 'durationSeconds must be > 0' });
      }
      fields.durationSeconds = n;
    }

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'No editable fields supplied' });
    }

    const updated = await sceneRepo.patchFields(sceneId, fields);
    const images = await sceneImageRepo.findByScene(sceneId);
    res.json({
      scene: {
        ...updated,
        imageVariants: await hydrateImageVariants(images),
        voiceSignedUrl: await urlFor(updated.voiceKey),
        videoSignedUrl: await urlFor(updated.videoKey),
        productReferenceSignedUrl: await urlFor(updated.productReferenceKey),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Upload (or replace) the product reference image for a single scene.
 * Stored on R2 at a stable per-scene key so re-uploading overwrites.
 *
 * Image generation registers a Higgsfield Soul ID from this file (see
 * /v1/custom-references) on the first variant job when Higgsfield is the
 * primary provider, then sends `custom_reference_id` for stronger lock
 * than `image_url` alone. Replacing the file clears the stored Soul ID.
 */
async function uploadProductReference(req, res, next) {
  try {
    const { id: projectId, sceneId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const scene = await sceneRepo.findById(sceneId);
    if (!scene || scene.projectId !== projectId) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    if (!r2Service.isConfigured()) {
      return res.status(503).json({ error: 'Object storage is not configured' });
    }

    // Pick extension from the uploaded mime type; fall back to .png.
    const mime = (file.mimetype || '').toLowerCase();
    const ext = mime.includes('jpeg') || mime.includes('jpg')
      ? 'jpg'
      : mime.includes('webp')
        ? 'webp'
        : 'png';

    const key = r2Service.keys.productReference(projectId, sceneId, ext);
    await r2Service.upload(key, file.buffer, file.mimetype || 'image/png');

    const updated = await sceneRepo.setProductReferenceKey(sceneId, key);
    res.json({
      scene: {
        ...updated,
        productReferenceSignedUrl: await urlFor(key),
      },
    });
  } catch (err) {
    next(err);
  }
}

/** Remove the product reference image for a single scene (no R2 delete). */
async function deleteProductReference(req, res, next) {
  try {
    const { id: projectId, sceneId } = req.params;
    const scene = await sceneRepo.findById(sceneId);
    if (!scene || scene.projectId !== projectId) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    if (scene.productReferenceKey && r2Service.isConfigured()) {
      // Fire-and-forget; if it fails we still null the column.
      r2Service.del(scene.productReferenceKey).catch(() => {});
    }
    const updated = await sceneRepo.setProductReferenceKey(sceneId, null);
    res.json({
      scene: {
        ...updated,
        productReferenceSignedUrl: null,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Copy this scene's product reference image onto every other scene in the
 * same project. Each destination gets its own R2 object (stable per-scene
 * key) so per-scene overrides remain possible later.
 */
async function applyProductReferenceToAll(req, res, next) {
  try {
    const { id: projectId, sceneId } = req.params;
    const sourceScene = await sceneRepo.findById(sceneId);
    if (!sourceScene || sourceScene.projectId !== projectId) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    if (!sourceScene.productReferenceKey) {
      return res.status(400).json({ error: 'Source scene has no product reference image' });
    }
    if (!r2Service.isConfigured()) {
      return res.status(503).json({ error: 'Object storage is not configured' });
    }

    // Preserve the source extension by copying it from the source key.
    const srcKey = sourceScene.productReferenceKey;
    const m = srcKey.match(/\.([a-z0-9]+)$/i);
    const ext = (m ? m[1] : 'png').toLowerCase();

    const others = (await sceneRepo.findByProject(projectId)).filter(
      (s) => s.id !== sceneId
    );

    let copied = 0;
    for (const target of others) {
      const dstKey = r2Service.keys.productReference(projectId, target.id, ext);
      try {
        await r2Service.copy(srcKey, dstKey);
        await sceneRepo.setProductReferenceKey(target.id, dstKey);
        copied += 1;
      } catch (err) {
        console.error(`Failed to copy product reference to scene ${target.id}:`, err.message);
      }
    }

    res.json({ updated: copied });
  } catch (err) {
    next(err);
  }
}

async function uploadSubtitleFont(req, res, next) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const project = await projectRepo.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const ext = path.extname(file.originalname || '.ttf').toLowerCase();
    if (!['.ttf', '.otf'].includes(ext)) {
      return res.status(400).json({ error: 'Only .ttf and .otf fonts are supported for burned subtitles' });
    }
    if (!r2Service.isConfigured()) {
      return res.status(503).json({ error: 'Object storage is not configured; cannot upload fonts' });
    }

    const key = `projects/${req.params.id}/subtitle-font${ext}`;
    await r2Service.upload(
      key,
      file.buffer,
      ext === '.otf' ? 'font/otf' : 'font/ttf'
    );

    const prev = project.subtitleSettings || {};
    const merged = { ...prev, customFontKey: key };
    const updated = await projectRepo.update(req.params.id, { subtitleSettings: merged });
    res.json({ project: updated });
  } catch (err) {
    next(err);
  }
}

async function uploadImage(req, res, next) {
  try {
    const { id: projectId, sceneId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const scene = await sceneRepo.findById(sceneId);
    if (!scene || scene.projectId !== projectId) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const filename = file.originalname.replace(/[^\w.-]+/g, '_');
    const r2Key = r2Service.keys.customUpload(projectId, sceneId, filename);

    if (r2Service.isConfigured()) {
      await r2Service.upload(r2Key, file.buffer, file.mimetype || 'application/octet-stream');
    }

    // Clear existing variants; replace with the uploaded image as variant 0.
    await sceneImageRepo.deleteForScene(sceneId);
    const [created] = await sceneImageRepo.bulkCreate(sceneId, [{
      variantIndex: 0,
      r2Key,
      isCustomUpload: true,
      promptUsed: null,
    }]);
    await sceneRepo.updateSelectedImage(sceneId, created.id);
    await sceneRepo.updateStatus(sceneId, 'image-ready');

    res.json({ sceneImage: created });
  } catch (err) {
    next(err);
  }
}

/**
 * Upload a product reference image and enqueue fal-ai/kling-image/o1 to merge
 * it into the selected (or specified) storyboard frame. New images are appended
 * as additional variants; existing variants are kept.
 */
async function insertProductOnSelectedFrame(req, res, next) {
  try {
    const { id: projectId, sceneId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const scene = await sceneRepo.findById(sceneId);
    if (!scene || scene.projectId !== projectId) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const sceneImageIdRaw = req.body?.sceneImageId;
    const sceneImageId =
      typeof sceneImageIdRaw === 'string' && sceneImageIdRaw.trim()
        ? sceneImageIdRaw.trim()
        : scene.selectedImageId;
    if (!sceneImageId) {
      return res.status(400).json({
        error: 'Select a frame first (or pass sceneImageId) before adding a product to it.',
      });
    }

    const baseRow = await sceneImageRepo.findById(sceneImageId);
    if (!baseRow || baseRow.sceneId !== sceneId || baseRow.shotId) {
      return res.status(404).json({ error: 'Scene image not found for this scene' });
    }

    if (!r2Service.isConfigured()) {
      return res.status(503).json({ error: 'Object storage is not configured; cannot run insert' });
    }

    const instruction =
      typeof req.body?.instruction === 'string' ? req.body.instruction.trim().slice(0, 2000) : '';
    const vc = Number(req.body?.variantCount);
    const variantCount = Number.isFinite(vc) ? Math.min(9, Math.max(1, vc)) : 3;

    const ext = imageExtFromMime(file.mimetype);
    const tempId = randomUUID();
    const productKey = r2Service.keys.insertProductTemp(projectId, sceneId, tempId, ext);
    await r2Service.upload(productKey, file.buffer, file.mimetype || 'application/octet-stream');

    const job = await queues.sceneImages.add('insert-product', {
      projectId,
      sceneId,
      baseSceneImageId: sceneImageId,
      productR2Key: productKey,
      instruction: instruction || null,
      variantCount,
    });

    res.json({ enqueued: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
}

async function generateSceneVoice(req, res, next) {
  try {
    const { id: projectId, sceneId } = req.params;
    const scene = await sceneRepo.findById(sceneId);
    if (!scene || scene.projectId !== projectId) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    const job = await queues.sceneVoice.add('generate', {
      projectId,
      sceneId,
      voiceId: req.body?.voiceId,
      voiceSettings: req.body?.voiceSettings,
    });
    res.json({ enqueued: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
}

async function regenerateSubtitles(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const job = await queues.projectSubtitles.add('generate', {
      projectId,
      subtitleSettings: req.body?.subtitleSettings,
    });
    res.json({ enqueued: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
}

async function generate(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const scenes = await sceneRepo.findByProject(projectId);
    if (scenes.length === 0) {
      return res.status(400).json({ error: 'Project has no scenes yet' });
    }
    // Validate selected images for both single-shot scenes and (when
    // any scene opted into multi-shot) every shot of every multi-shot
    // scene. Multi-shot projects normally go through /shots first; this
    // is the safety net for users who hit "Generate video" instead.
    const missing = [];
    for (const s of scenes) {
      if (s.multiShotEnabled) {
        const shots = await shotRepo.findByScene(s.id);
        if (shots.length === 0 || shots.some((sh) => !sh.selectedImageId)) {
          missing.push(s);
        }
      } else if (!s.selectedImageId) {
        missing.push(s);
      }
    }
    if (missing.length > 0) {
      return res.status(400).json({
        error:
          'All scenes (and every shot of multi-shot scenes) must have a selected image before generating',
        missingSceneIndices: missing.map((s) => s.sceneIndex),
      });
    }

    await projectRepo.updateStatus(projectId, 'generating');

    // Enqueue voiceover jobs for any scene without audio yet; they need to
    // complete before subtitles can be cut but Seedance can run in parallel.
    for (const scene of scenes) {
      if (!scene.voiceKey) {
        await queues.sceneVoice.add('generate', { projectId, sceneId: scene.id });
      }
      if (scene.multiShotEnabled) {
        const shots = await shotRepo.findByScene(scene.id);
        for (const shot of shots) {
          if (shot.videoKey) continue; // skip already-rendered shots
          await queues.shotVideo.add('submit', {
            projectId, sceneId: scene.id, shotId: shot.id,
          });
        }
      } else if (!scene.videoKey) {
        await queues.seedanceVideo.add('submit', { projectId, sceneId: scene.id });
      }
    }

    await pubsub.publish(projectId, { phase: 'pipeline', status: 'started' });

    res.json({ enqueued: true, sceneCount: scenes.length });
  } catch (err) {
    next(err);
  }
}

/**
 * Replace the entire scene list for a project. Used by the script-review
 * page when the user reorders, edits, adds, or deletes scenes before
 * approving image generation.
 *
 * Only allowed in pre-image states (draft, scripted, script-review).
 * Replacing scenes after image gen has started would orphan generated
 * images and videos.
 */
async function replaceScenes(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const { scenes } = req.body || {};

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({ error: 'scenes[] required' });
    }

    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const editableStates = new Set(['draft', 'scripted', 'script-review']);
    if (!editableStates.has(project.status)) {
      return res.status(409).json({
        error: `Cannot edit scenes once project status is '${project.status}'`,
      });
    }

    const normalised = scenes.map((s, i) => ({
      sceneIndex: i,
      imagePrompt: String(s.imagePrompt || '').trim(),
      voiceoverText: String(s.voiceoverText || '').trim(),
      durationSeconds: Number(s.durationSeconds) || 5,
    }));

    for (const s of normalised) {
      if (!s.imagePrompt || !s.voiceoverText) {
        return res.status(400).json({
          error: `Scene ${s.sceneIndex + 1}: imagePrompt and voiceoverText are required`,
        });
      }
    }

    const oldScenes = await sceneRepo.findByProject(projectId);
    const inserted = await sceneRepo.bulkReplace(projectId, normalised);

    // Product references are keyed by scene id on R2. Recreating rows would
    // orphan them unless we copy each old slot's reference onto the new row
    // at the same index (best-effort — matches reorder/split semantics).
    if (r2Service.isConfigured()) {
      const n = Math.min(inserted.length, oldScenes.length);
      for (let i = 0; i < n; i++) {
        const srcKey = oldScenes[i]?.productReferenceKey;
        if (!srcKey) continue;
        const m = srcKey.match(/\.([a-z0-9]+)$/i);
        const ext = (m ? m[1] : 'png').toLowerCase();
        const dstKey = r2Service.keys.productReference(projectId, inserted[i].id, ext);
        try {
          await r2Service.copy(srcKey, dstKey);
          await sceneRepo.setProductReferenceKey(inserted[i].id, dstKey);
          r2Service.del(srcKey).catch(() => {});
        } catch (err) {
          console.error(
            `[replaceScenes] product reference copy failed index=${i}:`,
            err.message || err
          );
        }
      }
      for (let i = inserted.length; i < oldScenes.length; i++) {
        const k = oldScenes[i]?.productReferenceKey;
        if (k) r2Service.del(k).catch(() => {});
      }
    }

    // Keep scene_count in sync if the user added/deleted scenes.
    if (inserted.length !== project.sceneCount) {
      await projectRepo.update(projectId, { sceneCount: inserted.length });
    }

    res.json({ scenes: inserted });
  } catch (err) {
    next(err);
  }
}

/**
 * Re-run Claude script generation for an existing project. Used when the
 * user is unhappy with the AI's first draft on the script-review page.
 * Wipes all existing scenes (and their images, by FK cascade) and goes
 * back to 'draft' status until the new script lands.
 */
async function regenerateScript(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const editableStates = new Set(['draft', 'scripted', 'script-review', 'failed']);
    if (!editableStates.has(project.status)) {
      return res.status(409).json({
        error: `Cannot regenerate script once project status is '${project.status}'`,
      });
    }

    const {
      sceneCount = project.sceneCount,
      totalDurationSeconds = null,
      language = 'English',
      tone = 'dramatic',
    } = req.body || {};

    await projectRepo.updateStatus(projectId, 'draft');

    await queues.sceneScript.add('generate', {
      projectId,
      input: project.sourceScript || project.topic,
      mode: project.sourceScript ? 'rewrite' : 'topic',
      sceneCount,
      styleId: project.styleId,
      totalDurationSeconds,
      language,
      tone,
      multiShotTargetSeconds: Number(project.multiShotTargetSeconds) || 2.5,
    });

    res.json({ enqueued: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Approve the AI-generated scenes and kick off per-scene image generation.
 * Moves status to 'images-pending' and enqueues image jobs.
 *
 * Idempotent by design: if the project has progressed past script-review,
 * we only enqueue scenes that don't already have image variants OR whose
 * stored `image_prompt` has changed since the last generation. This is
 * what fixes the "navigated back to script and now everything regenerates"
 * bug -- repeated approvals are now no-ops unless something actually changed.
 *
 * Pass `force: true` in the body to bypass the dedupe and regenerate every
 * scene's variants (used by an explicit "Regenerate all images" action).
 */
async function approveScript(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Allow re-approval from any post-script state. The dedupe below makes
    // it safe; only scenes with mismatched prompts (or no variants) requeue.
    const validFromStates = new Set([
      'scripted',
      'script-review',
      'images-pending',
      'images-review',
      'images-ready',
    ]);
    if (!validFromStates.has(project.status)) {
      return res.status(409).json({
        error: `Cannot approve script when project status is '${project.status}'`,
      });
    }

    const scenes = await sceneRepo.findByProject(projectId);
    if (scenes.length === 0) {
      return res.status(400).json({ error: 'Project has no scenes to approve' });
    }

    const variantCount = Math.min(
      Math.max(parseInt(req.body?.variantCount, 10) || 3, 1),
      6
    );
    const force = req.body?.force === true;

    // Decide which scenes to enqueue. A scene is enqueued when forced, when
    // it has no variants yet, or when its current image_prompt differs from
    // the prompt used to generate any of its existing variants.
    const toEnqueue = [];
    const skipped = [];

    for (const s of scenes) {
      if (force) {
        toEnqueue.push({ scene: s, clearExisting: true });
        continue;
      }
      const variants = await sceneImageRepo.findByScene(s.id);
      if (variants.length === 0) {
        toEnqueue.push({ scene: s, clearExisting: false });
        continue;
      }
      const promptChanged = variants.every(
        (v) => (v.promptUsed || '') !== (s.imagePrompt || '')
      );
      if (promptChanged) {
        toEnqueue.push({ scene: s, clearExisting: true });
      } else {
        skipped.push(s.id);
      }
    }

    // Only flip status back to images-pending if we actually have work to
    // do; otherwise leave the existing status (images-review/images-ready)
    // alone so the UI doesn't blink back into "generating".
    if (toEnqueue.length > 0) {
      await projectRepo.updateStatus(projectId, 'images-pending');
    }

    for (const item of toEnqueue) {
      await queues.sceneImages.add('generate-variants', {
        projectId,
        sceneId: item.scene.id,
        prompt: item.scene.imagePrompt,
        variantCount,
        clearExisting: item.clearExisting,
      });
    }

    if (toEnqueue.length > 0) {
      await pubsub.publish(projectId, {
        phase: 'images',
        status: 'started',
        sceneCount: toEnqueue.length,
      });
    }

    res.json({
      enqueued: toEnqueue.length > 0,
      enqueuedCount: toEnqueue.length,
      skippedCount: skipped.length,
      sceneCount: scenes.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Regenerate the Seedance video for a single scene without disturbing
 * its siblings. Used by the per-scene retry button on the status page.
 */
async function regenerateSceneVideo(req, res, next) {
  try {
    const { id: projectId, sceneId } = req.params;

    const scene = await sceneRepo.findById(sceneId);
    if (!scene || scene.projectId !== projectId) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    if (!scene.selectedImageId) {
      return res.status(400).json({ error: 'Scene has no selected image' });
    }

    // Reset video state for this scene only.
    await sceneRepo.updateStatus(sceneId, 'image-ready', null, null);

    const job = await queues.seedanceVideo.add('submit', { projectId, sceneId });
    await pubsub.publish(projectId, { sceneId, phase: 'video', status: 'requeued' });
    res.json({ enqueued: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
}

/**
 * Approve all per-scene videos and kick off the final assembly pipeline
 * (subtitles + ffmpeg concat + music mix + color grade + upload). Mirror
 * of approveScript: gates the heavy assembly step behind an explicit user
 * action so the user can preview/regenerate scene videos first.
 */
async function approveVideos(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // 'failed' is allowed so the user can retry assembly after a previous
    // ffmpeg run died, without re-rendering all the Seedance clips.
    // 'complete' is allowed so the user can re-assemble after revisiting
    // the videos page from the step nav (e.g. to apply new music/voice
    // settings). 'assembling' is a no-op safety net if a duplicate
    // request arrives while assembly is still running.
    const validFromStates = new Set([
      'videos-review',
      'generating',
      'failed',
      'assembling',
      'complete',
    ]);
    if (!validFromStates.has(project.status)) {
      return res.status(409).json({
        error: `Cannot approve videos when project status is '${project.status}'`,
      });
    }

    const scenes = await sceneRepo.findByProject(projectId);
    if (scenes.length === 0) {
      return res.status(400).json({ error: 'Project has no scenes' });
    }
    const missingScenes = [];
    for (const s of scenes) {
      if (s.multiShotEnabled) {
        const shots = await shotRepo.findByScene(s.id);
        if (shots.length === 0 || shots.some((sh) => !sh.videoKey)) {
          missingScenes.push(s);
        }
      } else if (!s.videoKey) {
        missingScenes.push(s);
      }
    }
    if (missingScenes.length > 0) {
      return res.status(400).json({
        error: 'All scenes must have a generated video before approving',
        missingSceneIndices: missingScenes.map((s) => s.sceneIndex),
      });
    }

    // Final assembly processor builds subtitles inline (if needed) and
    // then runs ffmpeg, so we don't enqueue projectSubtitles separately
    // here -- doing so used to race the assembly job and ship a final
    // cut without burned-in captions.
    await projectRepo.updateStatus(projectId, 'assembling');
    await queues.finalAssembly.add('assemble', { projectId });
    await pubsub.publish(projectId, { phase: 'assembly', status: 'started' });

    res.json({ enqueued: true });
  } catch (err) {
    next(err);
  }
}

async function generateHooks(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const { hookDurationSeconds = 10, variantCount = 3 } = req.body || {};

    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.outputKey) {
      return res.status(400).json({ error: 'Final video must be assembled before generating hooks' });
    }

    // Wipe previous hook attempts -- otherwise failed/old variants pile
    // up underneath the new ones in the UI. The worker also recreates
    // its own pending rows when it doesn't find the synthetic ones, so
    // this is safe even if the request is retried.
    await hookVariantRepo.deleteByProject(projectId);

    // Pre-create N pending rows synchronously so the UI immediately
    // shows skeleton cards on the next /api/projects fetch -- without
    // this, the rows only appear after the worker's Claude call lands
    // and users have to manually refresh to see anything happening.
    const placeholders = [];
    for (let i = 0; i < variantCount; i++) {
      const row = await hookVariantRepo.create({
        projectId,
        variantIndex: i,
        hookScript: '',
        hookDurationSeconds,
      });
      placeholders.push(row);
    }

    const job = await queues.hookGenerator.add('generate', {
      projectId,
      hookDurationSeconds,
      variantCount,
      placeholderIds: placeholders.map((p) => p.id),
    });
    res.json({
      enqueued: true,
      jobId: job.id,
      hookDurationSeconds,
      variantCount,
      hookVariants: placeholders,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:id/hooks/:hookId/retry
 * POST /api/projects/:id/hooks/retry   body: { hookId }
 *
 * Re-run a single hook variant using its existing script (no Claude
 * call). Used by the per-card "Retry" button so users don't have to
 * regenerate every variant just because one of them failed.
 *
 * The body-only `/hooks/retry` variant exists because some reverse proxies
 * mishandle long nested paths with multiple UUID segments.
 */
async function retryHookVariant(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const hookId = req.params.hookId || req.body?.hookId;
    if (!hookId) {
      return res.status(400).json({ error: 'hookId required (URL param or JSON body)' });
    }

    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.outputKey) {
      return res.status(400).json({ error: 'Final video must be assembled before retrying hooks' });
    }

    const existing = await hookVariantRepo.findById(hookId);
    if (!existing || existing.projectId !== projectId) {
      return res.status(404).json({ error: 'Hook variant not found' });
    }

    const reset = await hookVariantRepo.update(hookId, {
      status: 'pending',
      errorMessage: null,
    });

    const job = await queues.hookGenerator.add('retry', {
      projectId,
      retryIds: [hookId],
      hookDurationSeconds: existing.hookDurationSeconds,
    });

    res.json({ enqueued: true, jobId: job.id, hookVariant: reset || existing });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/projects/:id/hooks/failed
 *
 * Removes every hook_variant row for the project that is in 'failed'
 * status. Used by the "Clear failed" button to tidy up the variant
 * grid without wiping successful renders.
 */
async function clearFailedHookVariants(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const removed = await hookVariantRepo.deleteFailedByProject(projectId);
    res.json({ removed });
  } catch (err) {
    next(err);
  }
}

// ------- multi-shot handlers ----------------------------------------------

/**
 * Toggle multi-shot for a single scene.
 *   PATCH /projects/:id/scenes/:sceneId/multi-shot   { enabled: boolean }
 *
 * On enable: bootstrap scene_shots from scenes.suggested_shots (or fall
 *            back to a 2-shot template if Claude didn't supply any).
 * On disable: delete all scene_shots for the scene (FK cascade also
 *            removes any per-shot scene_images rows).
 *
 * Allowed in any state up to (but not including) shot-images-pending /
 * generating / assembling / complete -- the user toggles multi-shot on
 * the dedicated shots-review page before kicking off shot rendering.
 */
async function setMultiShot(req, res, next) {
  try {
    const { id: projectId, sceneId } = req.params;
    const { enabled } = req.body || {};

    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const scene = await sceneRepo.findById(sceneId);
    if (!scene || scene.projectId !== projectId) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const lockedStates = new Set([
      'shot-images-pending',
      'generating',
      'assembling',
      'complete',
    ]);
    if (lockedStates.has(project.status)) {
      return res.status(409).json({
        error: `Cannot change multi-shot once project status is '${project.status}'`,
      });
    }

    const wantOn = !!enabled;
    if (wantOn) {
      const seed =
        Array.isArray(scene.suggestedShots) && scene.suggestedShots.length >= 2
          ? scene.suggestedShots
          : [
              { role: 'wide', imagePrompt: `${scene.imagePrompt}. Wide establishing shot.` },
              { role: 'closeup', imagePrompt: `${scene.imagePrompt}. Tight close-up on the main subject.` },
            ];
      const targetSecs = Number(project.multiShotTargetSeconds) || 2.5;
      const existing = await shotRepo.findByScene(sceneId);
      // Only seed when the scene has no shots yet -- toggling on/off/on
      // should not silently wipe a shot list the user has already edited.
      if (existing.length === 0) {
        await shotRepo.bulkReplace(
          sceneId,
          seed.map((s) => ({ ...s, durationSeconds: targetSecs }))
        );
      }
    } else {
      await shotRepo.deleteByScene(sceneId);
    }

    const updated = await sceneRepo.setMultiShotEnabled(sceneId, wantOn);
    const shots = wantOn ? await shotRepo.findByScene(sceneId) : [];
    res.json({ scene: { ...updated, shots } });
  } catch (err) {
    next(err);
  }
}

/**
 * Bulk replace the shot list for one scene.
 *   PUT /projects/:id/scenes/:sceneId/shots   { shots: [{ role, imagePrompt, durationSeconds? }] }
 *
 * Re-numbers shot_index from 0. Deletes every existing shot (and its
 * images/video via FK cascade), so callers should only invoke this from
 * the shots-review page, before per-shot image jobs have been queued.
 */
async function replaceShots(req, res, next) {
  try {
    const { id: projectId, sceneId } = req.params;
    const { shots } = req.body || {};

    if (!Array.isArray(shots) || shots.length === 0) {
      return res.status(400).json({ error: 'shots[] must contain at least 1 shot' });
    }
    if (shots.length > 6) {
      return res.status(400).json({ error: 'shots[] is capped at 6 per scene' });
    }

    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const scene = await sceneRepo.findById(sceneId);
    if (!scene || scene.projectId !== projectId) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const editableStates = new Set([
      'images-review',
      'images-ready',
      'shots-review',
      'shot-images-review',
      'videos-review',
    ]);
    if (!editableStates.has(project.status)) {
      return res.status(409).json({
        error: `Cannot edit shots once project status is '${project.status}'`,
      });
    }

    const targetSecs = Number(project.multiShotTargetSeconds) || 2.5;
    const normalised = shots.map((s) => ({
      role: String(s.role || 'wide'),
      imagePrompt: String(s.imagePrompt || '').trim(),
      durationSeconds: Number(s.durationSeconds) || targetSecs,
      useApprovedSceneImage: !!s.useApprovedSceneImage,
    }));
    for (let i = 0; i < normalised.length; i++) {
      const isLocked = normalised[i].useApprovedSceneImage;
      if (isLocked) {
        // Locked shots inherit the scene's approved image -- their image
        // prompt is a marker the shotImagesProcessor recognises so it
        // skips regeneration. Require the scene to actually have an
        // approved variant at this point.
        if (!scene.selectedImageId) {
          return res.status(400).json({
            error: `Shot ${i + 1}: cannot reuse approved scene image -- scene has no selected variant yet`,
          });
        }
        normalised[i].imagePrompt = shotRepo.USE_APPROVED_SCENE_IMAGE_MARKER;
      } else if (!normalised[i].imagePrompt) {
        return res.status(400).json({ error: `Shot ${i + 1}: imagePrompt is required` });
      }
    }

    const inserted = await shotRepo.bulkReplace(sceneId, normalised);

    // For any locked shots, pre-populate selected_image_id with the scene's
    // approved variant so the shotVideoProcessor can render straight from
    // it later without needing per-shot image generation. We also flag the
    // shot as 'image-ready' so it doesn't sit in 'pending' forever.
    for (let i = 0; i < inserted.length; i++) {
      if (normalised[i].useApprovedSceneImage) {
        await shotRepo.updateSelectedImage(inserted[i].id, scene.selectedImageId);
        await shotRepo.updateStatus(inserted[i].id, 'image-ready', null, null);
        inserted[i].selectedImageId = scene.selectedImageId;
        inserted[i].status = 'image-ready';
      }
    }

    if (!scene.multiShotEnabled) {
      await sceneRepo.setMultiShotEnabled(sceneId, true);
    }
    res.json({ shots: inserted });
  } catch (err) {
    next(err);
  }
}

/**
 * Approve the shot list for the project. For every multi-shot scene whose
 * shots don't yet have variants, enqueue per-shot image jobs. Single-shot
 * scenes are untouched -- they keep their existing scene_images/Seedance.
 *
 *   POST /projects/:id/approve-shots   { variantCount?: number, force?: boolean }
 *
 * Idempotent: if the user re-approves with no edits and existing variants
 * cover the current prompts, we no-op (mirrors approveScript dedupe).
 */
async function approveShots(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // We permit approving shots even after the project has reached
    // 'videos-review' or 'failed', because the user may toggle a scene
    // into multi-shot AFTER seedance has already produced the single-
    // shot renders, then expect to render per-shot videos for that
    // scene. The terminal pipeline states (assembling/complete) are
    // still locked.
    const validFromStates = new Set([
      'images-review',
      'images-ready',
      'shots-review',
      'shot-images-pending',
      'shot-images-review',
      'videos-review',
      'generating',
      'failed',
    ]);
    if (!validFromStates.has(project.status)) {
      return res.status(409).json({
        error: `Cannot approve shots when project status is '${project.status}'`,
      });
    }

    const variantCount = Math.min(
      Math.max(parseInt(req.body?.variantCount, 10) || 3, 1),
      6
    );
    const force = req.body?.force === true;

    const scenes = await sceneRepo.findByProject(projectId);
    const multiScenes = scenes.filter((s) => s.multiShotEnabled);
    if (multiScenes.length === 0) {
      // Nothing to do -- pretend approval moves us straight to the videos step.
      return res.json({ enqueued: false, enqueuedCount: 0, sceneCount: 0 });
    }

    // We only enqueue (re-)generation when we actually have to:
    //   - The shot has no variants yet (first run).
    //   - The caller passed `force: true` (explicit "regenerate all").
    //
    // We do NOT try to auto-detect prompt drift here. The composed
    // promptUsed bakes in style + character anchors that legitimately
    // change between approve calls, and a heuristic comparison would
    // wipe the user's currently-selected variant + queue an expensive
    // regeneration just because the user clicked "Generate shot images"
    // a second time. If the user wants to re-roll, they can hit
    // "Regenerate" per-shot (which sets force on that one shot) or pass
    // `force: true` on this endpoint.
    let enqueuedCount = 0;
    for (const scene of multiScenes) {
      const shots = await shotRepo.findByScene(scene.id);
      for (const shot of shots) {
        // Locked shots reuse the scene's approved variant -- no need to
        // generate per-shot variants for them. Defensive: also ensure
        // their selected_image_id stays bound to the current approved
        // scene image (the user may have re-picked at images-review).
        if (shotRepo.isLockedShot(shot)) {
          if (scene.selectedImageId && shot.selectedImageId !== scene.selectedImageId) {
            await shotRepo.updateSelectedImage(shot.id, scene.selectedImageId);
          }
          if (shot.status !== 'image-ready') {
            await shotRepo.updateStatus(shot.id, 'image-ready', null, null);
          }
          continue;
        }
        const variants = await sceneImageRepo.findByShot(shot.id);
        if (force || variants.length === 0) {
          await queues.shotImages.add('generate-variants', {
            projectId,
            sceneId: scene.id,
            shotId: shot.id,
            variantCount,
            clearExisting: variants.length > 0,
          });
          enqueuedCount += 1;
        }
      }
    }

    if (enqueuedCount > 0) {
      await projectRepo.updateStatus(projectId, 'shot-images-pending');
      await pubsub.publish(projectId, {
        phase: 'shot-images',
        status: 'started',
        shotCount: enqueuedCount,
      });
    }

    res.json({
      enqueued: enqueuedCount > 0,
      enqueuedCount,
      sceneCount: multiScenes.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Pick a variant for one shot.
 *   PATCH /projects/:id/scenes/:sceneId/shots/:shotId/select-image
 *     { sceneImageId }
 */
async function selectShotImage(req, res, next) {
  try {
    const { id: projectId, sceneId, shotId } = req.params;
    const { sceneImageId } = req.body;
    if (!sceneImageId) return res.status(400).json({ error: 'sceneImageId required' });

    const img = await sceneImageRepo.findById(sceneImageId);
    if (!img || img.shotId !== shotId) {
      return res.status(404).json({ error: 'Image not found for this shot' });
    }
    const shot = await shotRepo.updateSelectedImage(shotId, sceneImageId);
    res.json({ shot });
  } catch (err) {
    next(err);
  }
}

/**
 * Regenerate variants for one shot (with optional new prompt).
 *   POST /projects/:id/scenes/:sceneId/shots/:shotId/regenerate-image
 *     { prompt?, variantCount? }
 */
async function regenerateShotImage(req, res, next) {
  try {
    const { id: projectId, sceneId, shotId } = req.params;
    const { prompt, variantCount = 3 } = req.body || {};

    const shot = await shotRepo.findById(shotId);
    if (!shot || shot.sceneId !== sceneId) {
      return res.status(404).json({ error: 'Shot not found' });
    }

    if (typeof prompt === 'string' && prompt.trim() && prompt.trim() !== shot.imagePrompt) {
      await shotRepo.patchFields(shotId, { imagePrompt: prompt.trim() });
    }

    const job = await queues.shotImages.add('generate-variants', {
      projectId,
      sceneId,
      shotId,
      variantCount,
      clearExisting: true,
      customPrompt: prompt || null,
    });

    res.json({ enqueued: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
}

/**
 * Approve the per-shot variants and kick off Seedance for every shot
 * (and any single-shot scenes that don't yet have video).
 *   POST /projects/:id/approve-shot-images
 */
async function approveShotImages(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const validFromStates = new Set([
      'shot-images-review',
      'shot-images-pending',
      'images-review',
      'images-ready',
      'generating',
      'videos-review',
      'failed',
    ]);
    if (!validFromStates.has(project.status)) {
      return res.status(409).json({
        error: `Cannot approve shot images when project status is '${project.status}'`,
      });
    }

    const scenes = await sceneRepo.findByProject(projectId);
    if (scenes.length === 0) {
      return res.status(400).json({ error: 'Project has no scenes' });
    }

    // Validate every multi-shot scene has every shot picked.
    for (const scene of scenes) {
      if (!scene.multiShotEnabled) continue;
      const shots = await shotRepo.findByScene(scene.id);
      if (shots.length === 0) {
        return res.status(400).json({
          error: `Scene ${scene.sceneIndex + 1} is multi-shot but has no shots configured`,
        });
      }
      for (const shot of shots) {
        if (!shot.selectedImageId) {
          return res.status(400).json({
            error: `Scene ${scene.sceneIndex + 1} shot ${shot.shotIndex + 1} has no selected image`,
          });
        }
      }
    }

    // Enforce single-shot scenes still have their scene-level image picked.
    const missingSingle = scenes.filter((s) => !s.multiShotEnabled && !s.selectedImageId);
    if (missingSingle.length > 0) {
      return res.status(400).json({
        error: 'All single-shot scenes must have a selected image before generating',
        missingSceneIndices: missingSingle.map((s) => s.sceneIndex),
      });
    }

    await projectRepo.updateStatus(projectId, 'generating');

    for (const scene of scenes) {
      // Voiceover for any scene that doesn't have one (parallel with video).
      if (!scene.voiceKey) {
        await queues.sceneVoice.add('generate', { projectId, sceneId: scene.id });
      }
      if (scene.multiShotEnabled) {
        const shots = await shotRepo.findByScene(scene.id);
        for (const shot of shots) {
          // Skip shots that already rendered successfully (re-approval).
          if (shot.videoKey) continue;
          await queues.shotVideo.add('submit', {
            projectId,
            sceneId: scene.id,
            shotId: shot.id,
          });
        }
      } else if (!scene.videoKey) {
        await queues.seedanceVideo.add('submit', { projectId, sceneId: scene.id });
      }
    }

    await pubsub.publish(projectId, { phase: 'pipeline', status: 'started' });
    res.json({ enqueued: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Re-order the shots inside one multi-shot scene without re-rendering.
 * Used by the scene-videos step so the user can rearrange shot videos
 * before final assembly stitches them together. Only allowed once every
 * shot has actually rendered (videoKey present) so we never re-order
 * mid-flight and confuse the pipeline.
 *
 *   PUT /projects/:id/scenes/:sceneId/shots/order   { orderedShotIds: string[] }
 */
async function reorderShots(req, res, next) {
  try {
    const { id: projectId, sceneId } = req.params;
    const { orderedShotIds } = req.body || {};

    if (!Array.isArray(orderedShotIds) || orderedShotIds.length === 0) {
      return res.status(400).json({ error: 'orderedShotIds[] is required' });
    }

    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const scene = await sceneRepo.findById(sceneId);
    if (!scene || scene.projectId !== projectId) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    if (!scene.multiShotEnabled) {
      return res
        .status(400)
        .json({ error: 'Scene is not multi-shot — nothing to reorder' });
    }

    const allowedStates = new Set([
      'shot-images-review',
      'videos-review',
      'failed',
    ]);
    if (!allowedStates.has(project.status)) {
      return res.status(409).json({
        error: `Cannot reorder shots when project status is '${project.status}'`,
      });
    }

    try {
      const reordered = await shotRepo.reorder(sceneId, orderedShotIds);
      res.json({ shots: reordered });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Re-run Seedance for ONE shot.
 *   POST /projects/:id/scenes/:sceneId/shots/:shotId/regenerate-video
 */
async function regenerateShotVideo(req, res, next) {
  try {
    const { id: projectId, sceneId, shotId } = req.params;
    const shot = await shotRepo.findById(shotId);
    if (!shot || shot.sceneId !== sceneId) {
      return res.status(404).json({ error: 'Shot not found' });
    }
    if (!shot.selectedImageId) {
      return res.status(400).json({ error: 'Shot has no selected image' });
    }
    await shotRepo.updateStatus(shotId, 'image-ready', null, null);
    const job = await queues.shotVideo.add('submit', { projectId, sceneId, shotId });
    await pubsub.publish(projectId, { sceneId, shotId, phase: 'shot-video', status: 'requeued' });
    res.json({ enqueued: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
}

async function statusStream(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const project = await projectRepo.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    // Disable socket inactivity timeouts on this long-lived response.
    if (req.socket && typeof req.socket.setTimeout === 'function') {
      req.socket.setTimeout(0);
    }
    if (req.socket && typeof req.socket.setNoDelay === 'function') {
      req.socket.setNoDelay(true);
    }
    if (req.socket && typeof req.socket.setKeepAlive === 'function') {
      req.socket.setKeepAlive(true, 30_000);
    }

    // Initial snapshot so the client doesn't sit empty.
    res.write(`event: snapshot\ndata: ${JSON.stringify({
      projectId, status: project.status, topic: project.topic,
    })}\n\n`);

    // Hint browsers to wait at least 15s before reconnecting on disconnect.
    res.write('retry: 15000\n\n');

    const unsubscribe = await pubsub.subscribe(projectId, (event) => {
      try { res.write(`data: ${JSON.stringify(event)}\n\n`); } catch (_) { /* ignore */ }
    });

    // Heartbeat at 15s — short enough to keep DevServer/HMR/proxies happy
    // and to detect a dead client quickly.
    const heartbeat = setInterval(() => {
      try { res.write(`: ping ${Date.now()}\n\n`); } catch (_) { /* ignore */ }
    }, 15_000);

    let closed = false;
    const cleanup = async () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      try { await unsubscribe(); } catch (_) { /* ignore */ }
    };
    req.on('close', cleanup);
    req.on('aborted', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadVisualReferences, deleteVisualReference,
  create, list, get, patch, remove,
  replaceScenes, regenerateScript, approveScript,
  patchScene,
  selectImage, regenerateImage, uploadImage, insertProductOnSelectedFrame, uploadSubtitleFont,
  uploadProductReference, deleteProductReference, applyProductReferenceToAll,
  generateSceneVoice,
  regenerateSceneVideo,
  regenerateSubtitles,
  approveVideos,
  generate, generateHooks, retryHookVariant, clearFailedHookVariants,
  statusStream,
  // Multi-shot handlers
  setMultiShot,
  replaceShots,
  approveShots,
  selectShotImage,
  regenerateShotImage,
  approveShotImages,
  regenerateShotVideo,
  reorderShots,
  upload: memoryUpload,
  fontUpload,
};
