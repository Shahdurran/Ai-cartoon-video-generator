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
const projectVisualReferenceRepo = require('../../../db/repositories/projectVisualReferenceRepo');
const r2Service = require('../../../services/r2Service');
const pubsub = require('../../../services/pubsubService');

const claude = new ClaudeService();

/** Resolve a media type Claude accepts. Falls back to image/png. */
function normaliseVisionMediaType(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'image/jpeg';
  if (m.includes('webp')) return 'image/webp';
  if (m.includes('gif')) return 'image/gif';
  return 'image/png';
}

/**
 * Pull this project's visual references off R2 as base64 blobs so they
 * can be inlined into the Claude messages payload. We cap at 4 images
 * (Anthropic vision works fine with more, but keeping the message small
 * keeps per-request latency / cost reasonable for the script step).
 */
async function loadVisualReferences(projectId) {
  if (!r2Service.isConfigured()) return [];
  const rows = await projectVisualReferenceRepo.findByProject(projectId);
  if (rows.length === 0) return [];
  const MAX = 4;
  const trimmed = rows.slice(0, MAX);
  const out = [];
  for (const ref of trimmed) {
    try {
      const buf = await r2Service.downloadToBuffer(ref.r2Key);
      out.push({
        base64: buf.toString('base64'),
        mediaType: normaliseVisionMediaType(ref.mimeType),
      });
    } catch (err) {
      console.warn(`[sceneScript] Could not load reference ${ref.r2Key}: ${err.message}`);
    }
  }
  return out;
}

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
    multiShotTargetSeconds = 2.5,
  } = job.data;

  if (!projectId) throw new Error('projectId required');

  await pubsub.publish(projectId, { phase: 'script', status: 'running' });

  try {
    const project = await projectRepo.findById(projectId);
    const visualNotes =
      typeof project?.visualNotes === 'string' && project.visualNotes.trim()
        ? project.visualNotes.trim()
        : null;
    const visualReferences = await loadVisualReferences(projectId);

    const { scenes, metadata } = await claude.generateSceneScript(input, {
      sceneCount,
      styleId,
      totalDurationSeconds,
      language,
      tone,
      mode,
      multiShotTargetSeconds,
      visualNotes,
      visualReferences,
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
