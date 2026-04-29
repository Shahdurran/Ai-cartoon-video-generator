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
  image_model_settings AS "imageModelSettings",
  video_model_settings AS "videoModelSettings",
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
    imageModelSettings = {},
    videoModelSettings = {},
    musicTrackId = null,
    musicVolume = 0.15,
  } = project;

  const { rows } = await query(
    `INSERT INTO projects
      (topic, source_script, style_id, scene_count, voice_id,
       voice_settings, subtitle_settings, image_model_settings, video_model_settings,
       music_track_id, music_volume)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11)
     RETURNING ${SELECT_COLUMNS}`,
    [
      topic, sourceScript, styleId, sceneCount, voiceId,
      JSON.stringify(voiceSettings), JSON.stringify(subtitleSettings),
      JSON.stringify(imageModelSettings), JSON.stringify(videoModelSettings),
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
 * List projects with per-project scene progress counters joined in. Used
 * by the home page so the user can see "Generating 3/8 images" and
 * similar without opening each project.
 *
 * Returns the same shape as `list()` but with extra fields:
 *   sceneProgress: {
 *     total, withImages, picked, failed, withVideo, queued
 *   }
 */
async function listWithProgress({ limit = 50, offset = 0 } = {}) {
  const { rows } = await query(
    `WITH scene_stats AS (
       SELECT
         s.project_id,
         COUNT(*)                                                     AS total,
         COUNT(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM scene_images si WHERE si.scene_id = s.id
         ))                                                           AS with_images,
         COUNT(*) FILTER (WHERE s.selected_image_id IS NOT NULL)      AS picked,
         COUNT(*) FILTER (WHERE s.status = 'failed')                  AS failed,
         COUNT(*) FILTER (WHERE s.video_key IS NOT NULL)              AS with_video,
         COUNT(*) FILTER (WHERE
           s.status IN ('pending', 'image-pending', 'voice-pending', 'video-pending')
         )                                                            AS queued
       FROM scenes s
       GROUP BY s.project_id
     )
     SELECT ${SELECT_COLUMNS},
            COALESCE(ss.total, 0)        AS "scenesTotal",
            COALESCE(ss.with_images, 0)  AS "scenesWithImages",
            COALESCE(ss.picked, 0)       AS "scenesPicked",
            COALESCE(ss.failed, 0)       AS "scenesFailed",
            COALESCE(ss.with_video, 0)   AS "scenesWithVideo",
            COALESCE(ss.queued, 0)       AS "scenesQueued"
     FROM projects p
     LEFT JOIN scene_stats ss ON ss.project_id = p.id
     ORDER BY p.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return rows.map((r) => {
    const {
      scenesTotal,
      scenesWithImages,
      scenesPicked,
      scenesFailed,
      scenesWithVideo,
      scenesQueued,
      ...project
    } = r;
    return {
      ...project,
      sceneProgress: {
        total: Number(scenesTotal) || 0,
        withImages: Number(scenesWithImages) || 0,
        picked: Number(scenesPicked) || 0,
        failed: Number(scenesFailed) || 0,
        withVideo: Number(scenesWithVideo) || 0,
        queued: Number(scenesQueued) || 0,
      },
    };
  });
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
    imageModelSettings: 'image_model_settings',
    videoModelSettings: 'video_model_settings',
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
    const isJson =
      key === 'voiceSettings' ||
      key === 'subtitleSettings' ||
      key === 'imageModelSettings' ||
      key === 'videoModelSettings';
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

module.exports = {
  create,
  findById,
  list,
  listWithProgress,
  update,
  updateStatus,
  remove,
};
