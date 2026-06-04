#!/usr/bin/env node
/**
 * Apply the V2.x SQL migrations to Supabase, in order, inside one transaction.
 *
 * All migrations are idempotent (ADD COLUMN IF NOT EXISTS), so this is safe to
 * re-run. Reads the connection string from SUPABASE_DB_URL (never hardcoded).
 *
 * Usage:
 *   SUPABASE_DB_URL='postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres' \
 *     node scripts/apply-migrations.mjs
 *
 * Get the string from: Supabase Dashboard -> Project Settings -> Database ->
 * Connection string -> "URI" (use the direct 5432 connection for DDL).
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const MIGRATIONS = [
  '20260304_email_events.sql',
  '20260305_autopilot_mode.sql',
  '20260306_family_invites.sql',
];

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'supabase', 'migrations');

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('ERROR: SUPABASE_DB_URL is not set. See the usage comment in this file.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('Connected. Applying migrations in a transaction...\n');
  await client.query('BEGIN');
  try {
    for (const file of MIGRATIONS) {
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      process.stdout.write(`  • ${file} ... `);
      await client.query(sql);
      console.log('ok');
    }
    await client.query('COMMIT');
    console.log('\nAll migrations applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nMigration failed, rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
