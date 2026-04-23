/**
 * Project repository.
 *
 * All persistence for the `projects` table. Thin SQL wrappers; no business
 * logic. Controllers compose these with scene/image/hook repos for responses.
 */

const { query } = require('../index');

const SELECT_COLUMNS = `
  id, topic, source_script AS "sourceScript",
  style_id AS "styleId", scene_count AS "sceneCount", status,
  voice_id AS "voiceId", voice_settings AS "voiceSettings",
  subtitle_settings AS "subtitleSettings",
  music_track_id AS "musicTrackId", music_volume AS "musicVolume",
  subtitles_key AS "subtitlesKey", output_key AS "outputKey",
  error_message AS "errorMessage",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

async function create(project) {
  const {
    topic = null,
    sourceScript = null,
    styleId = null,
    sceneCount,
    voiceId = null,
    voiceSettings = {},
    subtitleSettings = {},
    musicTrackId = null,
    musicVolume = 0.15,
  } = project;

  const { rows } = await query(
    `INSERT INTO projects
      (topic, source_script, style_id, scene_count, voice_id,
       voice_settings, subtitle_settings, music_track_id, music_volume)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
     RETURNING ${SELECT_COLUMNS}`,
    [
      topic, sourceScript, styleId, sceneCount, voiceId,
      JSON.stringify(voiceSettings), JSON.stringify(subtitleSettings),
      musicTrackId, musicVolume,
    ]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM projects WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function list({ limit = 50, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS}
     FROM projects
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

/**
 * Partial update. Accepts a subset of fields matching the project shape.
 */
async function update(id, patch) {
  const fieldMap = {
    topic: 'topic',
    sourceScript: 'source_script',
    styleId: 'style_id',
    sceneCount: 'scene_count',
    status: 'status',
    voiceId: 'voice_id',
    voiceSettings: 'voice_settings',
    subtitleSettings: 'subtitle_settings',
    musicTrackId: 'music_track_id',
    musicVolume: 'music_volume',
    subtitlesKey: 'subtitles_key',
    outputKey: 'output_key',
    errorMessage: 'error_message',
  };

  const sets = [];
  const values = [];
  let i = 1;

  for (const [key, column] of Object.entries(fieldMap)) {
    if (patch[key] === undefined) continue;
    const isJson = key === 'voiceSettings' || key === 'subtitleSettings';
    sets.push(`${column} = $${i}${isJson ? '::jsonb' : ''}`);
    values.push(isJson ? JSON.stringify(patch[key]) : patch[key]);
    i++;
  }

  if (sets.length === 0) return findById(id);

  sets.push('updated_at = now()');
  values.push(id);

  const { rows } = await query(
    `UPDATE projects SET ${sets.join(', ')} WHERE id = $${i}
     RETURNING ${SELECT_COLUMNS}`,
    values
  );
  return rows[0] || null;
}

async function updateStatus(id, status, errorMessage = null) {
  const { rows } = await query(
    `UPDATE projects SET status = $2, error_message = $3, updated_at = now()
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    [id, status, errorMessage]
  );
  return rows[0] || null;
}

async function remove(id) {
  await query('DELETE FROM projects WHERE id = $1', [id]);
}

module.exports = { create, findById, list, update, updateStatus, remove };
