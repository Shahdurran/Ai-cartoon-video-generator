/**
 * One-off migration script.
 *
 * Reads any legacy `storage/projects/*.json` files produced by the original
 * JSON-based storageService and imports them into Postgres. Idempotent:
 * uses ON CONFLICT DO NOTHING so re-running is safe.
 *
 * Usage: npm run migrate:json
 */

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const { pool, query, tx } = require('../db');

const PROJECTS_DIR = path.join(__dirname, '..', '..', 'storage', 'projects');

async function importProject(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.warn(`   ⚠️  Skipping malformed JSON: ${filePath}`);
    return;
  }

  const legacyId = data.id;
  if (!legacyId) {
    console.warn(`   ⚠️  Skipping project without id: ${filePath}`);
    return;
  }

  // Map as best we can. Fields not present in legacy shape get sane defaults.
  const topic = data.topic || data.title || null;
  const sourceScript = data.script || data.sourceScript || null;
  const styleId = data.styleId || null;
  const sceneCount = Array.isArray(data.scenes) ? data.scenes.length : (data.sceneCount || 1);
  const status = data.status || 'draft';

  await tx(async (client) => {
    // Insert project with its legacy id when it's a valid UUID. Otherwise let
    // Postgres allocate a new one and record the old id inside voice_settings
    // for traceability.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const useLegacyId = uuidRe.test(legacyId);

    const insertSql = useLegacyId
      ? `INSERT INTO projects (id, topic, source_script, style_id, scene_count, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`
      : `INSERT INTO projects (topic, source_script, style_id, scene_count, status, voice_settings)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id`;

    const params = useLegacyId
      ? [legacyId, topic, sourceScript, styleId, sceneCount, status]
      : [topic, sourceScript, styleId, sceneCount, status, JSON.stringify({ legacyId })];

    const { rows } = await client.query(insertSql, params);
    if (rows.length === 0) {
      console.log(`   ⏭  ${legacyId} (already imported)`);
      return;
    }
    const newId = rows[0].id;
    console.log(`   ✅ ${legacyId} → ${newId}`);

    // Import scenes if present
    if (Array.isArray(data.scenes)) {
      for (let i = 0; i < data.scenes.length; i++) {
        const s = data.scenes[i];
        await client.query(
          `INSERT INTO scenes
             (project_id, scene_index, image_prompt, voiceover_text, duration_seconds)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (project_id, scene_index) DO NOTHING`,
          [
            newId,
            s.sceneIndex ?? i,
            s.imagePrompt || '',
            s.voiceoverText || s.text || '',
            s.durationSeconds || 5,
          ]
        );
      }
    }
  });
}

async function main() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.log('ℹ️  No legacy storage/projects folder found — nothing to migrate');
    return;
  }

  const entries = await fs.readdir(PROJECTS_DIR);
  const jsonFiles = entries.filter((f) => f.endsWith('.json'));

  if (jsonFiles.length === 0) {
    console.log('ℹ️  No legacy JSON project files found');
    return;
  }

  console.log(`📦 Importing ${jsonFiles.length} legacy project file(s)...`);
  for (const file of jsonFiles) {
    try {
      await importProject(path.join(PROJECTS_DIR, file));
    } catch (err) {
      console.error(`   ❌ ${file}: ${err.message}`);
    }
  }
  console.log('✅ Legacy JSON migration complete');
}

if (require.main === module) {
  main()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = { main };
