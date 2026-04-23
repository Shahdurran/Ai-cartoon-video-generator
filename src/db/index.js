/**
 * PostgreSQL Connection Pool
 *
 * Uses DATABASE_URL (Railway-injected in production). Exports:
 *   - query(sql, params)           — one-off query
 *   - tx(async (client) => {...})  — transaction helper
 *   - getClient()                  — advanced use (remember to release())
 *   - pool                         — raw Pool for edge cases
 */

require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️  DATABASE_URL is not set. PostgreSQL features will be unavailable.');
}

// Railway provides DATABASE_URL with sslmode=require; local dev usually doesn't need SSL.
const needsSsl = /\bsslmode=require\b/i.test(connectionString || '') ||
  process.env.PGSSL === 'true';

const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.PG_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL pool error:', err);
});

async function query(sql, params) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }
  const start = Date.now();
  const res = await pool.query(sql, params);
  const elapsed = Date.now() - start;
  if (process.env.PG_LOG_QUERIES === 'true') {
    console.log(`[pg] ${elapsed}ms — ${sql.split('\n')[0].trim()}`);
  }
  return res;
}

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function getClient() {
  return pool.connect();
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, tx, getClient, close };
