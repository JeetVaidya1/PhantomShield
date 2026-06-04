#!/usr/bin/env node
/**
 * One-time backfill: encrypt any forwarding_email rows still stored in plaintext.
 *
 * Run this AFTER setting FORWARDING_ENCRYPTION_KEY in production and pulling it
 * locally (or run it in an environment that has both the service key and the
 * SAME encryption key). Idempotent: already-encrypted rows are skipped.
 *
 * Required env (e.g. via `node --env-file=.env.local`):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FORWARDING_ENCRYPTION_KEY
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-forwarding-encryption.mjs           # dry run
 *   node --env-file=.env.local scripts/backfill-forwarding-encryption.mjs --apply    # write
 */
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const keyHex = process.env.FORWARDING_ENCRYPTION_KEY;

if (!url || !serviceKey) throw new Error('Missing Supabase URL / service key');
if (!keyHex || keyHex.length !== 64) throw new Error('FORWARDING_ENCRYPTION_KEY must be 64 hex chars');

const key = Buffer.from(keyHex, 'hex');
const sb = createClient(url, serviceKey);

function looksEncrypted(v) {
  return v.length >= 56 && /^[0-9a-f]+$/i.test(v);
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('hex');
}

const { data, error } = await sb
  .from('identities')
  .select('id, forwarding_email')
  .not('forwarding_email', 'is', null);

if (error) throw new Error(`Query failed: ${error.message}`);

const toMigrate = (data ?? []).filter(
  (r) => r.forwarding_email && !looksEncrypted(r.forwarding_email)
);

console.log(`${data?.length ?? 0} rows with a forwarding_email; ${toMigrate.length} still plaintext.`);
if (!apply) {
  console.log('Dry run — re-run with --apply to encrypt them.');
  process.exit(0);
}

let migrated = 0;
for (const row of toMigrate) {
  const { error: upErr } = await sb
    .from('identities')
    .update({ forwarding_email: encrypt(row.forwarding_email) })
    .eq('id', row.id);
  if (upErr) console.error(`  failed ${row.id}: ${upErr.message}`);
  else migrated++;
}
console.log(`Encrypted ${migrated}/${toMigrate.length} rows.`);
