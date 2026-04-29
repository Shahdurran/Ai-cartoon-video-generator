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
 *   POST   /:id/scenes/:sceneId/upload-image                    -- multipart custom image
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
const styleRepo = require('../db/repositories/styleRepo');
const musicTrackRepo = require('../db/repositories/musicTrackRepo');
const hookVariantRepo = require('../db/repositories/hookVariantRepo');

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
      return {
        ...scene,
        imageVariants: await hydrateImageVariants(images),
        voiceSignedUrl: await urlFor(scene.voiceKey),
        videoSignedUrl: await urlFor(scene.videoKey),
        productReferenceSignedUrl: await urlFor(scene.productReferenceKey),
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

  return {
    ...project,
    scenes: fullScenes,
    hookVariants: hydratedHooks,
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
    } = req.body;

    if (!topic && !sourceScript) {
      return res.status(400).json({ error: 'Either topic or sourceScript is required' });
    }
    if (!styleId) {
      return res.status(400).json({ error: 'styleId is required' });
    }

    const style = await styleRepo.findById(styleId);
    if (!style) return res.status(400).json({ error: `Unknown styleId: ${styleId}` });

    if (musicTrackId) {
      const track = await musicTrackRepo.findById(musicTrackId);
      if (!track) return res.status(400).json({ error: `Unknown musicTrackId: ${musicTrackId}` });
    }

    const project = await projectRepo.create({
      topic, sourceScript, styleId, sceneCount,
      voiceId, voiceSettings, subtitleSettings,
      imageModelSettings, videoModelSettings,
      musicTrackId, musicVolume,
    });

    await queues.sceneScript.add('generate', {
      projectId: project.id,
      input: sourceScript || topic,
      mode: sourceScript ? 'rewrite' : 'topic',
      sceneCount,
      styleId,
      totalDurationSeconds,
      language,
      tone,
    });

    res.status(201).json({ project });
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
 * The reference is consumed by image generation as `image_url` (Higgsfield
 * Soul) or as image-to-image input where supported, so the product appears
 * consistently across regenerations of the scene.
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
    const missing = scenes.filter((s) => !s.selectedImageId);
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'All scenes must have a selected image before generating',
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
      await queues.seedanceVideo.add('submit', { projectId, sceneId: scene.id });
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

    const inserted = await sceneRepo.bulkReplace(projectId, normalised);

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
    const missingVideo = scenes.filter((s) => !s.videoKey);
    if (missingVideo.length > 0) {
      return res.status(400).json({
        error: 'All scenes must have a generated video before approving',
        missingSceneIndices: missingVideo.map((s) => s.sceneIndex),
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

    const job = await queues.hookGenerator.add('generate', {
      projectId,
      hookDurationSeconds,
      variantCount,
    });
    res.json({ enqueued: true, jobId: job.id, hookDurationSeconds, variantCount });
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
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    // Initial snapshot so the client doesn't sit empty.
    res.write(`event: snapshot\ndata: ${JSON.stringify({
      projectId, status: project.status, topic: project.topic,
    })}\n\n`);

    const unsubscribe = await pubsub.subscribe(projectId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // Heartbeat so intermediate proxies don't close the stream.
    const heartbeat = setInterval(() => {
      res.write(':\n\n');
    }, 30_000);

    req.on('close', async () => {
      clearInterval(heartbeat);
      await unsubscribe();
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create, list, get, patch, remove,
  replaceScenes, regenerateScript, approveScript,
  patchScene,
  selectImage, regenerateImage, uploadImage, uploadSubtitleFont,
  uploadProductReference, deleteProductReference, applyProductReferenceToAll,
  generateSceneVoice,
  regenerateSceneVideo,
  regenerateSubtitles,
  approveVideos,
  generate, generateHooks,
  statusStream,
  upload: memoryUpload,
  fontUpload,
};
