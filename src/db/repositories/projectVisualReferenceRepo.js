/**
 * Project-level visual reference images.
 *
 * Used by the New Project flow (step 1) so the user can attach 1..N
 * reference photos -- character art, style boards, packshots -- and our
 * Claude scene-script generator sees them via the vision API to keep
 * characters / aesthetic consistent across every generated imagePrompt.
 *
 * Stored on R2 under `projects/<projectId>/visual-references/<id>.<ext>`.
 * `mime_type` is captured so we can resend the original bytes to Claude
 * with the correct content-type instead of guessing later.
 */

const { query } = require('../index');

const SELECT_COLUMNS = `
  id, project_id AS "projectId",
  r2_key AS "r2Key",
  sort_index AS "sortIndex",
  mime_type AS "mimeType",
  created_at AS "createdAt"
`;

async function bulkCreate(projectId, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const inserted = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const { rows: out } = await query(
      `INSERT INTO project_visual_references
         (project_id, r2_key, sort_index, mime_type)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SELECT_COLUMNS}`,
      [projectId, r.r2Key, Number.isFinite(r.sortIndex) ? r.sortIndex : i, r.mimeType || null]
    );
    inserted.push(out[0]);
  }
  return inserted;
}

async function findByProject(projectId) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS}
     FROM project_visual_references
     WHERE project_id = $1
     ORDER BY sort_index ASC, created_at ASC`,
    [projectId]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM project_visual_references WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function remove(id) {
  const { rows } = await query(
    `DELETE FROM project_visual_references WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  bulkCreate,
  findByProject,
  findById,
  remove,
};
