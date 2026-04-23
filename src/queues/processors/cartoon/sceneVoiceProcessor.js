/**
 * Scene voice processor -- generates ElevenLabs audio for one scene and
 * uploads it to R2.
 *
 * Job data: { projectId, sceneId, voiceId?, voiceSettings? }
 *
 * If voiceId/voiceSettings omitted, the project's configured values are used.
 */

const elevenLabs = require('../../../services/elevenLabsService');
const r2Service = require('../../../services/r2Service');
const sceneRepo = require('../../../db/repositories/sceneRepo');
const projectRepo = require('../../../db/repositories/projectRepo');
const pubsub = require('../../../services/pubsubService');

module.exports = async function sceneVoiceProcessor(job) {
  const { projectId, sceneId } = job.data;
  if (!projectId || !sceneId) throw new Error('projectId and sceneId required');

  const scene = await sceneRepo.findById(sceneId);
  if (!scene) throw new Error(`Scene ${sceneId} not found`);
  const project = await projectRepo.findById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const voiceId = job.data.voiceId || project.voiceId;
  const voiceSettings = job.data.voiceSettings || project.voiceSettings || {};

  if (!voiceId) throw new Error('No voiceId configured on project or job');

  await pubsub.publish(projectId, { sceneId, phase: 'voice', status: 'running' });

  try {
    const buffer = await elevenLabs.generateAudio(voiceId, scene.voiceoverText, voiceSettings);
    const key = r2Service.keys.sceneVoice(projectId, sceneId, 'mp3');

    if (r2Service.isConfigured()) {
      await r2Service.upload(key, buffer, 'audio/mpeg');
    } else {
      console.warn('⚠️  R2 not configured; voice audio generated but not uploaded');
    }

    await sceneRepo.setVoiceKey(sceneId, key);
    await sceneRepo.updateStatus(sceneId, 'voice-ready');

    await pubsub.publish(projectId, { sceneId, phase: 'voice', status: 'complete' });
    return { sceneId, voiceKey: key, bytes: buffer.length };
  } catch (err) {
    await sceneRepo.updateStatus(sceneId, 'failed', err.message);
    await pubsub.publish(projectId, { sceneId, phase: 'voice', status: 'failed', error: err.message });
    throw err;
  }
};
