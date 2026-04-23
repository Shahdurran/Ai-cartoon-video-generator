/**
 * Project controller -- REST API for the AI Cartoon Generator.
 *
 * Routes (mounted under /api/projects):
 *   POST   /                                                    -- create project + kick off script gen
 *   GET    /                                                    -- list
 *   GET    /:id                                                 -- hydrated project (+ scenes, images, hooks)
 *   PATCH  /:id                                                 -- update settings
 *   DELETE /:id                                                 -- cascade delete + R2 cleanup
 *   PATCH  /:id/scenes/:sceneId/select-image                    -- choose a variant
 *   POST   /:id/scenes/:sceneId/regenerate-image                -- regenerate variants (optional new prompt)
 *   POST   /:id/scenes/:sceneId/upload-image                    -- multipart custom image
 *   POST   /:id/scenes/:sceneId/voice                           -- (re)generate voiceover for one scene
 *   POST   /:id/subtitles                                       -- (re)generate project-wide subtitles
 *   POST   /:id/generate                                        -- kick off Seedance + assembly
 *   POST   /:id/hooks                                           -- enqueue hook generator
 *   GET    /:id/status/stream                                   -- SSE progress
 */

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

// ------- helpers -------------------------------------------------------------

async function hydrateImageVariants(images) {
  return Promise.all(
    images.map(async (img) => ({
      ...img,
      signedUrl: r2Service.isConfigured()
        ? await r2Service.getSignedDownloadUrl(img.r2Key).catch(() => null)
        : null,
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
        voiceSignedUrl: scene.voiceKey && r2Service.isConfigured()
          ? await r2Service.getSignedDownloadUrl(scene.voiceKey).catch(() => null)
          : null,
        videoSignedUrl: scene.videoKey && r2Service.isConfigured()
          ? await r2Service.getSignedDownloadUrl(scene.videoKey).catch(() => null)
          : null,
      };
    })
  );

  const hydratedHooks = await Promise.all(
    hookVariants.map(async (h) => ({
      ...h,
      outputSignedUrl: h.outputKey && r2Service.isConfigured()
        ? await r2Service.getSignedDownloadUrl(h.outputKey).catch(() => null)
        : null,
    }))
  );

  const outputSignedUrl = project.outputKey && r2Service.isConfigured()
    ? await r2Service.getSignedDownloadUrl(project.outputKey).catch(() => null)
    : null;

  const subtitlesSignedUrl = project.subtitlesKey && r2Service.isConfigured()
    ? await r2Service.getSignedDownloadUrl(project.subtitlesKey).catch(() => null)
    : null;

  return {
    ...project,
    scenes: fullScenes,
    hookVariants: hydratedHooks,
    outputSignedUrl,
    subtitlesSignedUrl,
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
    const projects = await projectRepo.list({ limit, offset });
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
  selectImage, regenerateImage, uploadImage,
  generateSceneVoice,
  regenerateSubtitles,
  generate, generateHooks,
  statusStream,
  upload: memoryUpload,
};
