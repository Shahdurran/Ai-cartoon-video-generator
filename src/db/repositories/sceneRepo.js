/**
 * Scene repository. One row per scene in a project.
 */

const { query, tx } = require('../index');

const SELECT_COLUMNS = `
  id, project_id AS "projectId", scene_index AS "sceneIndex",
  image_prompt AS "imagePrompt", voiceover_text AS "voiceoverText",
  duration_seconds AS "durationSeconds",
  selected_image_id AS "selectedImageId",
  voice_key AS "voiceKey", video_key AS "videoKey",
  fal_request_id AS "falRequestId", status, error_message AS "errorMessage",
  created_at AS "createdAt"
`;

async function bulkCreate(projectId, scenes) {
  return tx(async (client) => {
    const inserted = [];
    for (const s of scenes) {
      const { rows } = await client.query(
        `INSERT INTO scenes
           (project_id, scene_index, image_prompt, voiceover_text, duration_seconds)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (project_id, scene_index)
         DO UPDATE SET
           image_prompt = EXCLUDED.image_prompt,
           voiceover_text = EXCLUDED.voiceover_text,
           duration_seconds = EXCLUDED.duration_seconds
         RETURNING ${SELECT_COLUMNS}`,
        [projectId, s.sceneIndex, s.imagePrompt, s.voiceoverText, s.durationSeconds]
      );
      inserted.push(rows[0]);
    }
    return inserted;
  });
}

async function findByProject(projectId) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS}
     FROM scenes
     WHERE project_id = $1
     ORDER BY scene_index ASC`,
    [projectId]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM scenes WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function updateSelectedImage(sceneId, sceneImageId) {
  const { rows } = await query(
    `UPDATE scenes SET selected_image_id = $2
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    [sceneId, sceneImageId]
  );
  return rows[0] || null;
}

async function updateStatus(sceneId, status, errorMessage = null) {
  const { rows } = await query(
    `UPDATE scenes SET status = $2, error_message = $3
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    [sceneId, status, errorMessage]
  );
  return rows[0] || null;
}

async function setFalRequestId(sceneId, requestId) {
  await query(
    `UPDATE scenes SET fal_request_id = $2 WHERE id = $1`,
    [sceneId, requestId]
  );
}

async function setVideoKey(sceneId, videoKey) {
  await query(
    `UPDATE scenes SET video_key = $2, status = 'video-ready' WHERE id = $1`,
    [sceneId, videoKey]
  );
}

async function setVoiceKey(sceneId, voiceKey) {
  await query(
    `UPDATE scenes SET voice_key = $2 WHERE id = $1`,
    [sceneId, voiceKey]
  );
}

async function countByStatus(projectId, status) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM scenes WHERE project_id = $1 AND status = $2`,
    [projectId, status]
  );
  return rows[0].count;
}

async function deleteByProject(projectId) {
  await query('DELETE FROM scenes WHERE project_id = $1', [projectId]);
}

module.exports = {
  bulkCreate,
  findByProject,
  findById,
  updateSelectedImage,
  updateStatus,
  setFalRequestId,
  setVideoKey,
  setVoiceKey,
  countByStatus,
  deleteByProject,
};
