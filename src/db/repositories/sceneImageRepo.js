/**
 * Scene image variants repository.
 *
 * Each scene has 0..N candidate images. Selection is tracked on
 * `scenes.selected_image_id`, not here.
 */

const { query, tx } = require('../index');

const SELECT_COLUMNS = `
  id, scene_id AS "sceneId", shot_id AS "shotId",
  variant_index AS "variantIndex",
  r2_key AS "r2Key", is_custom_upload AS "isCustomUpload",
  prompt_used AS "promptUsed", created_at AS "createdAt"
`;

async function bulkCreate(sceneId, variants, opts = {}) {
  const { shotId = null } = opts;
  return tx(async (client) => {
    const inserted = [];
    for (const v of variants) {
      const { rows } = await client.query(
        `INSERT INTO scene_images
           (scene_id, shot_id, variant_index, r2_key, is_custom_upload, prompt_used)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${SELECT_COLUMNS}`,
        [
          sceneId,
          v.shotId || shotId,
          v.variantIndex,
          v.r2Key,
          !!v.isCustomUpload,
          v.promptUsed || null,
        ]
      );
      inserted.push(rows[0]);
    }
    return inserted;
  });
}

async function create(sceneId, variant) {
  const { rows } = await query(
    `INSERT INTO scene_images
       (scene_id, shot_id, variant_index, r2_key, is_custom_upload, prompt_used)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${SELECT_COLUMNS}`,
    [
      sceneId,
      variant.shotId || null,
      variant.variantIndex,
      variant.r2Key,
      !!variant.isCustomUpload,
      variant.promptUsed || null,
    ]
  );
  return rows[0];
}

/**
 * Scene-level variants (legacy single-shot path: shot_id IS NULL).
 * Multi-shot scenes hide their shot variants from this query so the
 * existing image picker UI doesn't accidentally show them.
 */
async function findByScene(sceneId) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS}
     FROM scene_images
     WHERE scene_id = $1 AND shot_id IS NULL
     ORDER BY variant_index ASC`,
    [sceneId]
  );
  return rows;
}

async function findByShot(shotId) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS}
     FROM scene_images
     WHERE shot_id = $1
     ORDER BY variant_index ASC`,
    [shotId]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM scene_images WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function deleteForScene(sceneId) {
  // Only delete legacy scene-level variants. Per-shot variants are owned
  // by the shot row and cleaned up via the FK cascade when a shot is
  // deleted (or via deleteForShot when the user regenerates one shot).
  await query(
    `DELETE FROM scene_images WHERE scene_id = $1 AND shot_id IS NULL`,
    [sceneId]
  );
}

async function deleteForShot(shotId) {
  await query('DELETE FROM scene_images WHERE shot_id = $1', [shotId]);
}

module.exports = {
  bulkCreate,
  create,
  findByScene,
  findByShot,
  findById,
  deleteForScene,
  deleteForShot,
};
