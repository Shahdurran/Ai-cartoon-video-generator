/**
 * AI Cartoon Generator routes. Mounted at /api.
 *
 *   GET    /api/styles
 *   GET    /api/styles/:id
 *   GET    /api/voices
 *   GET    /api/music
 *   GET    /api/music/:id
 *
 *   POST   /api/projects
 *   GET    /api/projects
 *   GET    /api/projects/:id
 *   PATCH  /api/projects/:id
 *   DELETE /api/projects/:id
 *
 *   PATCH  /api/projects/:id/scenes/:sceneId/select-image
 *   POST   /api/projects/:id/scenes/:sceneId/regenerate-image
 *   POST   /api/projects/:id/scenes/:sceneId/upload-image      (multipart)
 *   POST   /api/projects/:id/scenes/:sceneId/voice
 *
 *   POST   /api/projects/:id/subtitles
 *   POST   /api/projects/:id/generate
 *   POST   /api/projects/:id/hooks
 *
 *   GET    /api/projects/:id/status/stream                     (SSE)
 */

const express = require('express');
const router = express.Router();

const styleController = require('../controllers/styleController');
const projectController = require('../controllers/projectController');
const cartoonMusicController = require('../controllers/cartoonMusicController');
const cartoonVoiceController = require('../controllers/cartoonVoiceController');

router.get('/styles', styleController.list);
router.get('/styles/:id', styleController.get);

router.get('/voices', cartoonVoiceController.list);

router.get('/music', cartoonMusicController.list);
router.get('/music/:id', cartoonMusicController.get);

router.post('/projects', projectController.create);
router.get('/projects', projectController.list);
router.get('/projects/:id', projectController.get);
router.patch('/projects/:id', projectController.patch);
router.delete('/projects/:id', projectController.remove);

router.patch(
  '/projects/:id/scenes/:sceneId/select-image',
  projectController.selectImage
);
router.post(
  '/projects/:id/scenes/:sceneId/regenerate-image',
  projectController.regenerateImage
);
router.post(
  '/projects/:id/scenes/:sceneId/upload-image',
  projectController.upload.single('image'),
  projectController.uploadImage
);
router.post(
  '/projects/:id/scenes/:sceneId/voice',
  projectController.generateSceneVoice
);

router.post('/projects/:id/subtitles', projectController.regenerateSubtitles);
router.post('/projects/:id/generate', projectController.generate);
router.post('/projects/:id/hooks', projectController.generateHooks);

router.get('/projects/:id/status/stream', projectController.statusStream);

module.exports = router;
