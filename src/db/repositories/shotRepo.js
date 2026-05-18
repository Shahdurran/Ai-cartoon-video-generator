/**
 * Scene-shot repository. One row per shot inside a multi-shot scene.
 *
 * A scene with `multi_shot_enabled = false` has zero rows here; its single
 * Seedance render lives directly on `scenes.video_key`.
 *
 * A scene with `multi_shot_enabled = true` has 2..N rows here; each one is
 * generated as its own image variant set + Seedance render. Final assembly
 * cross-cuts between the rendered shot videos with the scene's voiceover
 * playing continuously across the cuts.
 */

const { query, tx } = require('../index');

/**
 * Sentinel stored in scene_shots.image_prompt for "locked" shots whose
 * image is reused from the parent scene's approved variant instead of
 * being generated. The shotImagesProcessor skips these and the
 * shots-review UI shows them with the approved-image thumbnail directly.
 */
const USE_APPROVED_SCENE_IMAGE_MARKER = '__use_approved_scene_image__';

function isLockedShot(shot) {
  return !!shot && shot.imagePrompt === USE_APPROVED_SCENE_IMAGE_MARKER;
}

const SELECT_COLUMNS = `
  id, scene_id AS "sceneId", shot_index AS "shotIndex",
  role, image_prompt AS "imagePrompt",
  selected_image_id AS "selectedImageId",
  fal_request_id AS "falRequestId",
  video_key AS "videoKey",
  duration_seconds AS "durationSeconds",
  status, error_message AS "errorMessage", error_code AS "errorCode",
  created_at AS "createdAt"
`;

/**
 * Re-order a scene's shots in a single transaction. `orderedIds` must be
 * the full set of existing shot UUIDs for the scene, in the desired new
 * order. We rewrite shot_index in two passes (temporary negative indices,
 * then positive) so the UNIQUE(scene_id, shot_index) constraint never
 * trips mid-update.
 */
async function reorder(sceneId, orderedIds) {
  return tx(async (client) => {
    const { rows: existing } = await client.query(
      `SELECT id FROM scene_shots WHERE scene_id = $1`,
      [sceneId]
    );
    const existingIds = new Set(existing.map((r) => r.id));
    if (existingIds.size !== orderedIds.length) {
      throw new Error('orderedIds length does not match existing shots');
    }
    for (const id of orderedIds) {
      if (!existingIds.has(id)) {
        throw new Error(`Shot ${id} does not belong to scene ${sceneId}`);
      }
    }

    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        `UPDATE scene_shots SET shot_index = $2 WHERE id = $1 AND scene_id = $3`,
        [orderedIds[i], -(i + 1), sceneId]
      );
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        `UPDATE scene_shots SET shot_index = $2 WHERE id = $1 AND scene_id = $3`,
        [orderedIds[i], i, sceneId]
      );
    }

    const { rows } = await client.query(
      `SELECT ${SELECT_COLUMNS}
       FROM scene_shots
       WHERE scene_id = $1
       ORDER BY shot_index ASC`,
      [sceneId]
    );
    return rows;
  });
}

async function bulkReplace(sceneId, shots) {
  return tx(async (client) => {
    await client.query('DELETE FROM scene_shots WHERE scene_id = $1', [sceneId]);
    const inserted = [];
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      const { rows } = await client.query(
        `INSERT INTO scene_shots
           (scene_id, shot_index, role, image_prompt, duration_seconds)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${SELECT_COLUMNS}`,
        [
          sceneId,
          i,
          String(s.role || 'wide').slice(0, 32),
          String(s.imagePrompt || '').trim(),
          Number(s.durationSeconds) || 2.5,
        ]
      );
      inserted.push(rows[0]);
    }
    return inserted;
  });
}

async function findByScene(sceneId) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS}
     FROM scene_shots
     WHERE scene_id = $1
     ORDER BY shot_index ASC`,
    [sceneId]
  );
  return rows;
}

async function findByProject(projectId) {
  const { rows } = await query(
    `SELECT ss.id, ss.scene_id AS "sceneId", ss.shot_index AS "shotIndex",
            ss.role, ss.image_prompt AS "imagePrompt",
            ss.selected_image_id AS "selectedImageId",
            ss.fal_request_id AS "falRequestId",
            ss.video_key AS "videoKey",
            ss.duration_seconds AS "durationSeconds",
            ss.status, ss.error_message AS "errorMessage", ss.error_code AS "errorCode",
            ss.created_at AS "createdAt"
     FROM scene_shots ss
     INNER JOIN scenes s ON s.id = ss.scene_id
     WHERE s.project_id = $1
     ORDER BY s.scene_index ASC, ss.shot_index ASC`,
    [projectId]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM scene_shots WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function deleteByScene(sceneId) {
  await query('DELETE FROM scene_shots WHERE scene_id = $1', [sceneId]);
}

async function updateStatus(shotId, status, errorMessage = null, errorCode = null) {
  const { rows } = await query(
    `UPDATE scene_shots
     SET status = $2, error_message = $3, error_code = $4
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    [shotId, status, errorMessage, errorCode]
  );
  return rows[0] || null;
}

async function updateSelectedImage(shotId, sceneImageId) {
  const { rows } = await query(
    `UPDATE scene_shots
     SET selected_image_id = $2
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    [shotId, sceneImageId]
  );
  return rows[0] || null;
}

async function setFalRequestId(shotId, requestId) {
  await query(
    `UPDATE scene_shots SET fal_request_id = $2 WHERE id = $1`,
    [shotId, requestId]
  );
}

async function setVideoKey(shotId, videoKey) {
  await query(
    `UPDATE scene_shots
     SET video_key = $2, status = 'video-ready', error_message = NULL, error_code = NULL
     WHERE id = $1`,
    [shotId, videoKey]
  );
}

async function clearShotVideo(shotId) {
  await query(
    `UPDATE scene_shots
     SET video_key = NULL,
         fal_request_id = NULL,
         status = 'image-ready',
         error_message = NULL,
         error_code = NULL
     WHERE id = $1`,
    [shotId]
  );
}

/**
 * Patch a shot's editable fields (image_prompt, role, duration). Used by
 * the shots-review UI to tweak prompts in place. Pass null/undefined to
 * leave a field unchanged.
 */
async function patchFields(shotId, fields) {
  const sets = [];
  const args = [shotId];
  let i = 2;

  if (typeof fields.imagePrompt === 'string') {
    sets.push(`image_prompt = $${i++}`);
    args.push(fields.imagePrompt.trim());
  }
  if (typeof fields.role === 'string') {
    sets.push(`role = $${i++}`);
    args.push(fields.role.slice(0, 32));
  }
  if (fields.durationSeconds != null) {
    sets.push(`duration_seconds = $${i++}`);
    args.push(Number(fields.durationSeconds));
  }

  if (sets.length === 0) return findById(shotId);

  const { rows } = await query(
    `UPDATE scene_shots SET ${sets.join(', ')}
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    args
  );
  return rows[0] || null;
}

module.exports = {
  bulkReplace,
  reorder,
  findByScene,
  findByProject,
  findById,
  deleteByScene,
  updateStatus,
  updateSelectedImage,
  setFalRequestId,
  setVideoKey,
  clearShotVideo,
  patchFields,
  USE_APPROVED_SCENE_IMAGE_MARKER,
  isLockedShot,
};
