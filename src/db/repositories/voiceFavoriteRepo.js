/**
 * Voice favorites repository.
 *
 * Single-tenant tool: there is no `users` table yet, so favorites are
 * shared across browsers. We persist them in Postgres rather than the
 * client so the user's starred set survives reinstalls and is the same
 * everywhere they use the app.
 */

const { query } = require('../index');

async function list() {
  const { rows } = await query(
    `SELECT voice_id AS "voiceId", created_at AS "createdAt"
     FROM voice_favorites
     ORDER BY created_at DESC`
  );
  return rows;
}

async function listIds() {
  const rows = await list();
  return rows.map((r) => r.voiceId);
}

async function add(voiceId) {
  await query(
    `INSERT INTO voice_favorites (voice_id)
     VALUES ($1)
     ON CONFLICT (voice_id) DO NOTHING`,
    [voiceId]
  );
}

async function remove(voiceId) {
  await query(`DELETE FROM voice_favorites WHERE voice_id = $1`, [voiceId]);
}

module.exports = { list, listIds, add, remove };
