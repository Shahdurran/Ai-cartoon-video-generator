/**
 * Database seeding.
 *
 * Idempotent: safe to run on every deploy. Seeds:
 *   - Style library (from src/config/styles.seed.js)
 *   - Music tracks from the local music-library folder (uploaded to R2 if
 *     configured, otherwise just indexed with their local path as r2_key).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const styleRepo = require('./repositories/styleRepo');
const musicTrackRepo = require('./repositories/musicTrackRepo');
const { pool } = require('./index');
const stylesSeed = require('../config/styles.seed');

const MUSIC_LIBRARY_DIR = path.join(__dirname, '..', '..', 'music-library');

async function seedStyles() {
  const count = await styleRepo.seed(stylesSeed);
  console.log(`   ✅ Styles: ${count} records upserted`);
}

async function seedMusicTracks() {
  if (!fs.existsSync(MUSIC_LIBRARY_DIR)) {
    console.log('   ⏭  Music library folder missing, skipping');
    return;
  }
  const files = fs
    .readdirSync(MUSIC_LIBRARY_DIR)
    .filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f));

  if (files.length === 0) {
    console.log('   ⏭  No music files to seed');
    return;
  }

  const tracks = files.map((name) => ({
    name: path.parse(name).name,
    // Keep the same relative key whether we're local or R2-backed; upload
    // of the actual binary happens separately (admin action) to avoid
    // slow first boots.
    r2Key: `music-library/${name}`,
    durationSeconds: null,
    tags: [],
  }));

  const count = await musicTrackRepo.seed(tracks);
  console.log(`   ✅ Music tracks: ${count} records scanned`);
}

async function main() {
  console.log('🌱 Seeding database...');
  await seedStyles();
  await seedMusicTracks();
  console.log('✅ Seed complete');
}

if (require.main === module) {
  main()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = { main, seedStyles, seedMusicTracks };
