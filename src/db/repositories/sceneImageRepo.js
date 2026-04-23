/**
 * Scene image variants repository.
 *
 * Each scene has 0..N candidate images. Selection is tracked on
 * `scenes.selected_image_id`, not here.
 */

const { query, tx } = require('../index');

const SELECT_COLUMNS = `
  id, scene_id AS "sceneId", variant_index AS "variantIndex",
  r2_key AS "r2Key", is_custom_upload AS "isCustomUpload",
  prompt_used AS "promptUsed", created_at AS "createdAt"
`;

async function bulkCreate(sceneId, variants) {
  return tx(async (client) => {
    const inserted = [];
    for (const v of variants) {
      const { rows } = await client.query(
        `INSERT INTO scene_images
           (scene_id, variant_index, r2_key, is_custom_upload, prompt_used)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${SELECT_COLUMNS}`,
        [
          sceneId,
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
       (scene_id, variant_index, r2_key, is_custom_upload, prompt_used)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_COLUMNS}`,
    [
      sceneId,
      variant.variantIndex,
      variant.r2Key,
      !!variant.isCustomUpload,
      variant.promptUsed || null,
    ]
  );
  return rows[0];
}

async function findByScene(sceneId) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS}
     FROM scene_images
     WHERE scene_id = $1
     ORDER BY variant_index ASC`,
    [sceneId]
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
  await query('DELETE FROM scene_images WHERE scene_id = $1', [sceneId]);
}

module.exports = { bulkCreate, create, findByScene, findById, deleteForScene };
