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
  fal_request_id AS "falRequestId",
  product_reference_key AS "productReferenceKey",
  status, error_message AS "errorMessage", error_code AS "errorCode",
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

/**
 * Wholesale replace the scene list for a project. Used by the script-review
 * page when the user has reordered, edited, added, or deleted scenes.
 *
 * Done in a single transaction: delete every existing scene (and via FK
 * cascade their scene_images), then insert the new list with re-numbered
 * scene_index values starting at 0. Returns the freshly inserted rows.
 *
 * Caller should only invoke this while the project is in 'draft' or
 * 'script-review' state -- replacing scenes mid-pipeline would orphan
 * generated images / videos.
 */
async function bulkReplace(projectId, scenes) {
  return tx(async (client) => {
    await client.query(
      `DELETE FROM scenes WHERE project_id = $1`,
      [projectId]
    );
    const inserted = [];
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const { rows } = await client.query(
        `INSERT INTO scenes
           (project_id, scene_index, image_prompt, voiceover_text, duration_seconds)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${SELECT_COLUMNS}`,
        [projectId, i, s.imagePrompt, s.voiceoverText, s.durationSeconds]
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

/**
 * Update status with optional human-readable message and stable error code.
 * Passing `null` for either clears that column. Stable codes:
 *   content_policy | rate_limit | network | auth | quota | timeout | unknown
 */
async function updateStatus(sceneId, status, errorMessage = null, errorCode = null) {
  const { rows } = await query(
    `UPDATE scenes SET status = $2, error_message = $3, error_code = $4
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    [sceneId, status, errorMessage, errorCode]
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
    `UPDATE scenes SET video_key = $2, status = 'video-ready', error_message = NULL, error_code = NULL
     WHERE id = $1`,
    [sceneId, videoKey]
  );
}

async function setVoiceKey(sceneId, voiceKey) {
  await query(
    `UPDATE scenes SET voice_key = $2 WHERE id = $1`,
    [sceneId, voiceKey]
  );
}

/**
 * Patch one or more editable fields on a single scene without disturbing
 * its image variants, voice, or video. Used by the global Scenes drawer
 * after image generation has started so users can tweak narration / prompt
 * / duration of one scene at a time.
 *
 * Pass `null` for any field to leave it unchanged. `productReferenceKey`
 * accepts the empty string to explicitly clear the reference.
 */
async function patchFields(sceneId, fields) {
  const sets = [];
  const args = [sceneId];
  let i = 2;

  if (typeof fields.imagePrompt === 'string') {
    sets.push(`image_prompt = $${i++}`);
    args.push(fields.imagePrompt);
  }
  if (typeof fields.voiceoverText === 'string') {
    sets.push(`voiceover_text = $${i++}`);
    args.push(fields.voiceoverText);
  }
  if (fields.durationSeconds != null) {
    sets.push(`duration_seconds = $${i++}`);
    args.push(Number(fields.durationSeconds));
  }
  if (fields.productReferenceKey !== undefined) {
    sets.push(`product_reference_key = $${i++}`);
    args.push(fields.productReferenceKey || null);
  }

  if (sets.length === 0) return findById(sceneId);

  const { rows } = await query(
    `UPDATE scenes SET ${sets.join(', ')}
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    args
  );
  return rows[0] || null;
}

async function setProductReferenceKey(sceneId, key) {
  const { rows } = await query(
    `UPDATE scenes SET product_reference_key = $2
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    [sceneId, key || null]
  );
  return rows[0] || null;
}

async function setProductReferenceForProject(projectId, key, exceptSceneId) {
  const params = [projectId, key || null];
  let where = 'project_id = $1';
  if (exceptSceneId) {
    where += ' AND id <> $3';
    params.push(exceptSceneId);
  }
  const { rowCount } = await query(
    `UPDATE scenes SET product_reference_key = $2 WHERE ${where}`,
    params
  );
  return rowCount;
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
  bulkReplace,
  findByProject,
  findById,
  updateSelectedImage,
  updateStatus,
  setFalRequestId,
  setVideoKey,
  setVoiceKey,
  patchFields,
  setProductReferenceKey,
  setProductReferenceForProject,
  countByStatus,
  deleteByProject,
};
