/**
 * Cartoon scene script processor.
 *
 * Job data:
 *   { projectId, input, mode: 'topic'|'rewrite', sceneCount, styleId,
 *     totalDurationSeconds, language, tone }
 *
 * On completion:
 *   1. Inserts scenes via sceneRepo.bulkCreate.
 *   2. Updates project.status to 'scripted'.
 *   3. Enqueues one cartoon-scene-images job per scene.
 */

const ClaudeService = require('../../../services/claudeService');
const sceneRepo = require('../../../db/repositories/sceneRepo');
const projectRepo = require('../../../db/repositories/projectRepo');
const pubsub = require('../../../services/pubsubService');
const { queues } = require('../../cartoonQueues');

const claude = new ClaudeService();

module.exports = async function sceneScriptProcessor(job) {
  const {
    projectId,
    input,
    mode = 'topic',
    sceneCount,
    styleId = null,
    totalDurationSeconds = null,
    language = 'English',
    tone = 'dramatic',
  } = job.data;

  if (!projectId) throw new Error('projectId required');

  await pubsub.publish(projectId, { phase: 'script', status: 'running' });

  try {
    const { scenes, metadata } = await claude.generateSceneScript(input, {
      sceneCount,
      styleId,
      totalDurationSeconds,
      language,
      tone,
      mode,
    });

    const inserted = await sceneRepo.bulkCreate(projectId, scenes);
    await projectRepo.updateStatus(projectId, 'scripted');

    // Auto-queue image generation for every scene.
    for (const s of inserted) {
      await queues.sceneImages.add('generate-variants', {
        projectId,
        sceneId: s.id,
        prompt: s.imagePrompt,
        variantCount: 3,
      });
    }

    await pubsub.publish(projectId, { phase: 'script', status: 'complete', sceneCount: inserted.length });

    return { sceneCount: inserted.length, scenes: inserted, metadata };
  } catch (err) {
    await projectRepo.updateStatus(projectId, 'failed', err.message);
    await pubsub.publish(projectId, { phase: 'script', status: 'failed', error: err.message });
    throw err;
  }
};
