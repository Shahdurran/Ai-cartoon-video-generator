/**
 * Style library repository.
 *
 * Styles are seeded once from src/config/styles.seed.js and treated as
 * read-only from the API (v1).
 */

const { query, tx } = require('../index');

const SELECT_COLUMNS = `
  id, name, thumbnail_key AS "thumbnailKey",
  flux_prompt_suffix AS "fluxPromptSuffix",
  negative_prompt AS "negativePrompt",
  ffmpeg_color_grade AS "ffmpegColorGrade",
  created_at AS "createdAt"
`;

async function list() {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM styles ORDER BY id ASC`
  );
  return rows;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM styles WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Idempotent seed -- inserts new styles, updates existing ones (so edits to
 * the seed file take effect on next deploy).
 */
async function seed(styles) {
  return tx(async (client) => {
    for (const s of styles) {
      await client.query(
        `INSERT INTO styles
           (id, name, thumbnail_key, flux_prompt_suffix, negative_prompt, ffmpeg_color_grade)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           thumbnail_key = EXCLUDED.thumbnail_key,
           flux_prompt_suffix = EXCLUDED.flux_prompt_suffix,
           negative_prompt = EXCLUDED.negative_prompt,
           ffmpeg_color_grade = EXCLUDED.ffmpeg_color_grade`,
        [
          s.id,
          s.name,
          s.thumbnail_key || null,
          s.flux_prompt_suffix,
          s.negative_prompt || null,
          s.ffmpeg_color_grade || null,
        ]
      );
    }
    return styles.length;
  });
}

module.exports = { list, findById, seed };
