const { Pool } = require('pg');
require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// FIXES applied here:
//  #1  ssl rejectUnauthorized:false  — fixes "self-signed certificate" error
//  #4  connectionTimeoutMillis:10000 — fixes "connection timeout" (was 2000)
//  #5  SSL always on                 — works for both IPv4 pooler & direct
//  #7  rejectUnauthorized:false      — fixes SSL cert chain error
//  #8  Use port 6543 in DATABASE_URL — handled in env var, not here
//  #9  DATABASE_URL read from env    — no hardcoded fallback
//
// DATABASE_URL format for Render env vars:
//   postgresql://postgres.YOURREF:YOURPASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
// Note: do NOT append ?sslmode=no-verify to the URL — ssl config below handles it
// ─────────────────────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set!');
  console.error('Set it in Render → Environment with your Supabase Transaction Pooler URL');
  process.exit(1);
}

// Strip ?sslmode=... from URL if present — we control SSL via the config below
const connStr = process.env.DATABASE_URL.replace(/\?.*$/, '');

const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },  // required for Supabase SSL
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,      // 10s — enough for Supabase pooler cold start
});

pool.on('connect',  ()    => console.log('DB client connected'));
pool.on('error',    (err) => console.error('DB idle client error:', err.message));

// Test connection on startup — shows DB error in logs immediately if misconfigured
pool.query('SELECT NOW()')
  .then(r  => console.log('Supabase DB connected at', r.rows[0].now))
  .catch(e => console.error('DB startup check FAILED:', e.message));

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
