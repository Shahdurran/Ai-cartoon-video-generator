/**
 * Cartoon scene script processor.
 *
 * Job data:
 *   { projectId, input, mode: 'topic'|'rewrite', sceneCount, styleId,
 *     totalDurationSeconds, language, tone }
 *
 * On completion:
 *   1. Inserts scenes via sceneRepo.bulkReplace (so re-runs cleanly
 *      replace any prior scene set, e.g. on POST /regenerate-script).
 *   2. Updates project.status to 'script-review'.
 *
 * Image generation is NOT auto-enqueued. The user must explicitly approve
 * the script via POST /api/projects/:id/approve-script. This is the
 * step that was missing from the original flow -- users were landing on
 * a page where image generation had already failed without any chance
 * to review or edit the AI-produced scenes first.
 */

const ClaudeService = require('../../../services/claudeService');
const sceneRepo = require('../../../db/repositories/sceneRepo');
const projectRepo = require('../../../db/repositories/projectRepo');
const pubsub = require('../../../services/pubsubService');

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

    // bulkReplace (not bulkCreate) so re-running script gen cleanly wipes
    // any prior scene set -- needed for POST /regenerate-script.
    const inserted = await sceneRepo.bulkReplace(projectId, scenes);
    await projectRepo.updateStatus(projectId, 'script-review');

    await pubsub.publish(projectId, {
      phase: 'script',
      status: 'complete',
      sceneCount: inserted.length,
      nextStep: 'script-review',
    });

    return { sceneCount: inserted.length, scenes: inserted, metadata };
  } catch (err) {
    await projectRepo.updateStatus(projectId, 'failed', err.message);
    await pubsub.publish(projectId, { phase: 'script', status: 'failed', error: err.message });
    throw err;
  }
};
