const express = require('express');
const router = express.Router();

// Import controllers
const ScriptController = require('../controllers/scriptController');
const VoiceController = require('../controllers/voiceController');
const ImageController = require('../controllers/imageController');
const ChannelController = require('../controllers/channelController');
const BatchController = require('../controllers/batchController');
const QueueController = require('../controllers/queueController');
const PromptTemplateController = require('../controllers/promptTemplateController');
const DashboardController = require('../controllers/dashboardController');
const SystemStatusController = require('../controllers/systemStatusController');
const StepByStepController = require('../controllers/stepByStepController');
const { VideoBankController, upload: videoUpload } = require('../controllers/videoBankController');
const { MusicLibraryController, upload: musicUpload } = require('../controllers/musicLibraryController');
const { PersonVideoController, upload: personVideoUpload } = require('../controllers/personVideoController');
const { SoundWaveController, upload: soundWaveUpload } = require('../controllers/soundWaveController');
const { VoiceCloneController, upload: voiceCloneUpload } = require('../controllers/voiceCloneController');
const VideoLibraryController = require('../controllers/videoLibraryController');

// ===== Script Routes =====
router.post('/script/generate', ScriptController.generateScript);
router.post('/script/image-prompts', ScriptController.generateImagePrompts);
router.post('/script/refine', ScriptController.refineScript);
router.get('/script/job/:jobId', ScriptController.getJobStatus);

// ===== Voice Routes =====
router.post('/voice/generate', VoiceController.generateVoice);
router.get('/voice/list', VoiceController.getAvailableVoices);
router.get('/voice/job/:jobId', VoiceController.getJobStatus);

// ===== Voice Clone Routes =====
router.get('/voice-clones', VoiceCloneController.listVoiceClones);
router.post('/voice-clones', voiceCloneUpload.single('audio_file'), VoiceCloneController.createVoiceClone);
router.delete('/voice-clones/:id', VoiceCloneController.deleteVoiceClone);

// ===== Image Routes =====
router.post('/image/generate', ImageController.generateImage);
router.post('/image/generate-multiple', ImageController.generateMultipleImages);
router.get('/image/job/:jobId', ImageController.getJobStatus);

// ===== Channel Routes =====
router.post('/channel', ChannelController.createChannel);
router.get('/channel', ChannelController.listChannels);
router.get('/channel/:channelId', ChannelController.getChannel);
router.put('/channel/:channelId', ChannelController.updateChannel);
router.delete('/channel/:channelId', ChannelController.deleteChannel);

// ===== Template Routes (Video Templates) =====
router.post('/template', ChannelController.createTemplate);
router.get('/template', ChannelController.listTemplates);
router.get('/template/:templateId', ChannelController.getTemplate);

// ===== Prompt Template Routes =====
router.get('/prompt-templates', PromptTemplateController.getAllTemplates);
router.get('/prompt-templates/categories', PromptTemplateController.getCategories);
router.get('/prompt-templates/search', PromptTemplateController.searchTemplates);
router.get('/prompt-templates/category/:category', PromptTemplateController.getTemplatesByCategory);
router.get('/prompt-templates/:id', PromptTemplateController.getTemplate);
router.post('/prompt-templates', PromptTemplateController.createTemplate);
router.put('/prompt-templates/:id', PromptTemplateController.updateTemplate);
router.delete('/prompt-templates/:id', PromptTemplateController.deleteTemplate);
router.post('/prompt-templates/:id/duplicate', PromptTemplateController.duplicateTemplate);
router.get('/prompt-templates/:id/export', PromptTemplateController.exportTemplate);
router.post('/prompt-templates/import', PromptTemplateController.importTemplate);

// ===== Batch Routes =====
router.post('/batch', BatchController.createBatch);
router.get('/batch', BatchController.listBatches);
router.get('/batch/:batchId', BatchController.getBatchStatus);
router.get('/batch/job/:jobId', BatchController.getJobStatus);

// ===== Queue Management Routes =====
router.get('/queue', QueueController.getAllQueuesStatus);
router.get('/queue/:queueName', QueueController.getQueueStatus);
router.post('/queue/:queueName/clean', QueueController.cleanQueue);
router.post('/queue/:queueName/pause', QueueController.pauseQueue);
router.post('/queue/:queueName/resume', QueueController.resumeQueue);
router.get('/queue/:queueName/job/:jobId', QueueController.getJobStatus);
router.delete('/queue/:queueName/job/:jobId', QueueController.deleteJob);

// ===== Dashboard Routes =====
router.get('/dashboard/analytics', DashboardController.getAnalytics);
router.get('/dashboard/recent-activity', DashboardController.getRecentActivity);
router.get('/dashboard/today-summary', DashboardController.getTodaySummary);

// ===== System Status Routes =====
router.get('/system/health', SystemStatusController.getSystemHealth);
router.post('/system/health/test/:service', SystemStatusController.testService);
router.get('/system/api-usage', SystemStatusController.getAPIUsage);
router.get('/system/resources', SystemStatusController.getResourceUsage);
router.get('/system/info', SystemStatusController.getSystemInfo);
router.get('/system/export-report', SystemStatusController.exportStatusReport);

// ===== Video Bank Routes =====
router.get('/video-bank/scan', VideoBankController.scanVideos);
router.post('/video-bank/refresh', VideoBankController.refreshVideos);
router.get('/video-bank/stats', VideoBankController.getStats);
router.post('/video-bank/upload', videoUpload.single('video'), VideoBankController.uploadVideo);
router.post('/video-bank/thumbnail/:filename', VideoBankController.regenerateThumbnail);
router.delete('/video-bank/:filename', VideoBankController.deleteVideo);

// ===== Music Library Routes =====
router.get('/music-library/scan', MusicLibraryController.scanMusic);
router.post('/music-library/refresh', MusicLibraryController.refreshMusic);
router.get('/music-library/stats', MusicLibraryController.getStats);
router.post('/music-library/upload', musicUpload.single('music'), MusicLibraryController.uploadMusic);
router.get('/music-library/:filename', MusicLibraryController.getMusicInfo);
router.delete('/music-library/:filename', MusicLibraryController.deleteMusic);

// ===== Person Video Library Routes =====
router.get('/person-videos/scan', PersonVideoController.scanPersonVideos);
router.post('/person-videos/refresh', PersonVideoController.refreshCache);
router.get('/person-videos/stats', PersonVideoController.getStats);
router.post('/person-videos/upload', personVideoUpload.single('personVideo'), PersonVideoController.uploadPersonVideo);
router.post('/person-videos/thumbnail/:filename', PersonVideoController.regenerateThumbnail);
router.get('/person-videos/:filename', PersonVideoController.getPersonVideoInfo);
router.delete('/person-videos/:filename', PersonVideoController.deletePersonVideo);

// ===== Sound Wave Library Routes =====
router.get('/sound-waves/library', SoundWaveController.scanSoundWaves);
router.post('/sound-waves/refresh', SoundWaveController.refreshCache);
router.get('/sound-waves/stats', SoundWaveController.getStats);
router.post('/sound-waves/upload', soundWaveUpload.single('soundWave'), SoundWaveController.uploadSoundWave);
router.post('/sound-waves/thumbnail/:filename', SoundWaveController.regenerateThumbnail);
router.get('/sound-waves/:filename', SoundWaveController.getSoundWaveInfo);
router.delete('/sound-waves/:filename', SoundWaveController.deleteSoundWave);

// ===== Step-by-Step Video Generation Routes (Preview/Review Workflow) =====
router.post('/video/generate-script', StepByStepController.generateScript);
router.post('/video/generate-voice', StepByStepController.generateVoice);
router.post('/video/generate-images', StepByStepController.generateImages);
router.post('/video/regenerate-asset', StepByStepController.regenerateAsset);
router.post('/video/generate-final', StepByStepController.generateFinal);

// Session routes - ORDER MATTERS! More specific routes first
router.get('/video/sessions/channel/:channelId', StepByStepController.getSessionsByChannel); // Get sessions by channel
router.get('/video/sessions', StepByStepController.listSessions); // Get all sessions
router.get('/video/session/:sessionId', StepByStepController.getSessionDetails); // Get full session details for reuse
router.delete('/video/session/:sessionId', StepByStepController.deleteSession);

// ===== Video Library Routes (Generated Videos) =====
router.get('/video-library', VideoLibraryController.listVideos);
router.get('/video-library/stats', VideoLibraryController.getStats);
router.post('/video-library/generate-all-thumbnails', VideoLibraryController.generateAllThumbnails);
router.get('/video-library/:videoId', VideoLibraryController.getVideo);
router.post('/video-library/:videoId/thumbnail', VideoLibraryController.generateThumbnail);
router.delete('/video-library/:videoId', VideoLibraryController.deleteVideo);

module.exports = router;

