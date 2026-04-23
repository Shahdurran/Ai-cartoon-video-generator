/**
 * Hook variant repository.
 *
 * Hooks are alternative 10-15 second openings spliced onto the front of a
 * generated cartoon. Each project can have multiple variants.
 */

const { query } = require('../index');

const SELECT_COLUMNS = `
  id, project_id AS "projectId", variant_index AS "variantIndex",
  hook_script AS "hookScript",
  hook_duration_seconds AS "hookDurationSeconds",
  output_key AS "outputKey", status, error_message AS "errorMessage",
  created_at AS "createdAt"
`;

async function create(hook) {
  const { rows } = await query(
    `INSERT INTO hook_variants
       (project_id, variant_index, hook_script, hook_duration_seconds)
     VALUES ($1, $2, $3, $4)
     RETURNING ${SELECT_COLUMNS}`,
    [hook.projectId, hook.variantIndex, hook.hookScript, hook.hookDurationSeconds]
  );
  return rows[0];
}

async function update(id, patch) {
  const fields = {
    hookScript: 'hook_script',
    outputKey: 'output_key',
    status: 'status',
    errorMessage: 'error_message',
  };
  const sets = [];
  const values = [];
  let i = 1;
  for (const [key, column] of Object.entries(fields)) {
    if (patch[key] === undefined) continue;
    sets.push(`${column} = $${i}`);
    values.push(patch[key]);
    i++;
  }
  if (sets.length === 0) return findById(id);
  values.push(id);
  const { rows } = await query(
    `UPDATE hook_variants SET ${sets.join(', ')} WHERE id = $${i}
     RETURNING ${SELECT_COLUMNS}`,
    values
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM hook_variants WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function listByProject(projectId) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS}
     FROM hook_variants
     WHERE project_id = $1
     ORDER BY variant_index ASC`,
    [projectId]
  );
  return rows;
}

module.exports = { create, update, findById, listByProject };
