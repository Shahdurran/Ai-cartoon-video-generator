/**
 * Migration runner.
 *
 * Executes every `src/db/migrations/*.sql` file in filename order, tracking
 * applied migrations in a `schema_migrations` table.
 *
 * Can be invoked directly (`node src/db/migrate.js`) from the Railway
 * startCommand, or imported and awaited from app startup when
 * RUN_MIGRATIONS_ON_STARTUP=true.
 */

const fs = require('fs');
const path = require('path');
const { pool, tx } = require('./index');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename     TEXT PRIMARY KEY,
      applied_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function listMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort();
}

async function runMigrations({ silent = false } = {}) {
  if (!process.env.DATABASE_URL) {
    if (!silent) {
      console.warn('⚠️  Skipping migrations: DATABASE_URL not configured');
    }
    return { applied: [], skipped: true };
  }

  const files = listMigrations();
  if (!silent) {
    console.log(`🗄️  Running migrations from ${MIGRATIONS_DIR} (${files.length} files)`);
  }

  const applied = [];

  // Run each migration in its own transaction so a partial failure doesn't
  // leave the DB in an inconsistent state.
  for (const filename of files) {
    const alreadyAppliedCheck = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [filename]
    ).catch(async (err) => {
      // schema_migrations doesn't exist yet — create it in a throwaway tx.
      if (err.code === '42P01') {
        await tx(async (c) => ensureMigrationsTable(c));
        return { rowCount: 0 };
      }
      throw err;
    });

    if (alreadyAppliedCheck.rowCount > 0) {
      if (!silent) console.log(`   ⏭  ${filename} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');

    await tx(async (client) => {
      await ensureMigrationsTable(client);
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
        [filename]
      );
    });

    applied.push(filename);
    if (!silent) console.log(`   ✅ ${filename}`);
  }

  if (!silent) {
    if (applied.length === 0) {
      console.log('✅ No new migrations to apply');
    } else {
      console.log(`✅ Applied ${applied.length} migration(s)`);
    }
  }

  return { applied, skipped: false };
}

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = { runMigrations };
