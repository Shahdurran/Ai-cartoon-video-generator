/**
 * Jobs audit repository.
 *
 * Complements Bull's own state by persisting a longer history of what was
 * queued and how it terminated. Useful for the projects detail view.
 */

const { query } = require('../index');

const SELECT_COLUMNS = `
  id, project_id AS "projectId", queue_name AS "queueName",
  job_bull_id AS "jobBullId", job_type AS "jobType",
  status, payload, result, error_message AS "errorMessage",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

async function create(job) {
  const { rows } = await query(
    `INSERT INTO jobs
       (project_id, queue_name, job_bull_id, job_type, status, payload)
     VALUES ($1, $2, $3, $4, COALESCE($5, 'queued'), $6::jsonb)
     RETURNING ${SELECT_COLUMNS}`,
    [
      job.projectId || null,
      job.queueName,
      job.jobBullId || null,
      job.jobType,
      job.status || 'queued',
      JSON.stringify(job.payload || {}),
    ]
  );
  return rows[0];
}

async function update(id, patch) {
  const fields = {
    jobBullId: 'job_bull_id',
    status: 'status',
    result: 'result',
    errorMessage: 'error_message',
  };
  const sets = [];
  const values = [];
  let i = 1;
  for (const [key, column] of Object.entries(fields)) {
    if (patch[key] === undefined) continue;
    const isJson = key === 'result';
    sets.push(`${column} = $${i}${isJson ? '::jsonb' : ''}`);
    values.push(isJson ? JSON.stringify(patch[key]) : patch[key]);
    i++;
  }
  if (sets.length === 0) return findById(id);
  sets.push('updated_at = now()');
  values.push(id);
  const { rows } = await query(
    `UPDATE jobs SET ${sets.join(', ')} WHERE id = $${i}
     RETURNING ${SELECT_COLUMNS}`,
    values
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM jobs WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function listByProject(projectId) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM jobs WHERE project_id = $1
     ORDER BY created_at DESC`,
    [projectId]
  );
  return rows;
}

module.exports = { create, update, findById, listByProject };
