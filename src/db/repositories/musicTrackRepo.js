/**
 * Music tracks repository.
 */

const { query, tx } = require('../index');

const SELECT_COLUMNS = `
  id, name, r2_key AS "r2Key",
  duration_seconds AS "durationSeconds", tags,
  created_at AS "createdAt"
`;

async function list() {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM music_tracks ORDER BY name ASC`
  );
  return rows;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${SELECT_COLUMNS} FROM music_tracks WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function create(track) {
  const { rows } = await query(
    `INSERT INTO music_tracks (name, r2_key, duration_seconds, tags)
     VALUES ($1, $2, $3, $4)
     RETURNING ${SELECT_COLUMNS}`,
    [track.name, track.r2Key, track.durationSeconds || null, track.tags || []]
  );
  return rows[0];
}

/**
 * Idempotent seed keyed on (name, r2_key). Used by db/seed.js to import the
 * existing local music-library folder.
 */
async function seed(tracks) {
  return tx(async (client) => {
    for (const t of tracks) {
      await client.query(
        `INSERT INTO music_tracks (name, r2_key, duration_seconds, tags)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM music_tracks WHERE name = $1 AND r2_key = $2
         )`,
        [t.name, t.r2Key, t.durationSeconds || null, t.tags || []]
      );
    }
    return tracks.length;
  });
}

module.exports = { list, findById, create, seed };
