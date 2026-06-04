import { Pool } from 'pg';

/**
 * SimpleLogin database bridge (v2-011).
 *
 * SimpleLogin runs its own PostgreSQL with an `alias` table. We control both
 * databases on the same VPS, so we write directly to SimpleLogin's tables
 * rather than going through its web-dashboard API
 * (see ARCHITECTURE-V2-FINAL.md Section 3A).
 *
 * Connection string comes from SIMPLELOGIN_DB_URI and is NEVER logged.
 */

const MAX_POOL_CONNECTIONS = 5;
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 100;

let pool: Pool | null = null;

/** Lazily create a pooled connection to SimpleLogin's Postgres. */
function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.SIMPLELOGIN_DB_URI;
  if (!connectionString) {
    throw new Error('SIMPLELOGIN_DB_URI is not configured');
  }

  pool = new Pool({ connectionString, max: MAX_POOL_CONNECTIONS });
  return pool;
}

/** Test seam: inject a mock pool and reset between tests. */
export function __setPoolForTests(p: Pool | null): void {
  pool = p;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a DB operation with retry on transient failure: 3 attempts with
 * exponential backoff (100ms, 200ms, 400ms). Errors are rethrown without
 * leaking the connection string or credentials.
 */
async function withRetry<T>(label: string, op: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      return await op();
    } catch (error: unknown) {
      lastError = error;
      if (attempt < RETRY_ATTEMPTS - 1) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }
  }
  // Deliberately generic message — never echo the DB URI or query params.
  throw new Error(
    `SimpleLogin bridge "${label}" failed after ${RETRY_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : 'unknown error'
    }`
  );
}

/** The single SimpleLogin service user that owns all Phantom Defender aliases. */
function serviceUserId(): number {
  const id = process.env.SIMPLELOGIN_SERVICE_USER_ID;
  const parsed = id ? Number(id) : NaN;
  if (!Number.isInteger(parsed)) {
    throw new Error('SIMPLELOGIN_SERVICE_USER_ID is not configured');
  }
  return parsed;
}

/**
 * Resolve (creating if needed) the SimpleLogin mailbox id for a forwarding
 * address under the service user. Aliases forward to this mailbox.
 */
async function resolveMailboxId(forwardingEmail: string): Promise<number> {
  const client = getPool();
  const userId = serviceUserId();

  const existing = await client.query(
    'SELECT id FROM mailbox WHERE user_id = $1 AND email = $2 LIMIT 1',
    [userId, forwardingEmail]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id as number;
  }

  const created = await client.query(
    `INSERT INTO mailbox (user_id, email, verified, created_at, updated_at)
     VALUES ($1, $2, true, NOW(), NOW())
     RETURNING id`,
    [userId, forwardingEmail]
  );
  return created.rows[0].id as number;
}

export interface CreatedAlias {
  /** SimpleLogin's alias.id (bigint) — stored on our identity record. */
  simpleloginAliasId: number;
  aliasEmail: string;
  mailboxId: number;
}

/**
 * Create an alias in SimpleLogin that forwards aliasEmail -> forwardingEmail.
 * Returns the SimpleLogin alias id so the caller can persist it on our identity.
 */
export async function createAlias(
  userId: string,
  aliasEmail: string,
  forwardingEmail: string
): Promise<CreatedAlias> {
  return withRetry('createAlias', async () => {
    const client = getPool();
    const mailboxId = await resolveMailboxId(forwardingEmail);

    const result = await client.query(
      `INSERT INTO alias (email, enabled, user_id, mailbox_id, note, created_at, updated_at)
       VALUES ($1, true, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      [aliasEmail, serviceUserId(), mailboxId, `pd:${userId}`]
    );

    return {
      simpleloginAliasId: result.rows[0].id as number,
      aliasEmail,
      mailboxId,
    };
  });
}

/** Disable an alias in SimpleLogin so it stops forwarding. */
export async function deactivateAlias(aliasId: number): Promise<void> {
  await withRetry('deactivateAlias', async () => {
    const client = getPool();
    await client.query(
      'UPDATE alias SET enabled = false, updated_at = NOW() WHERE id = $1',
      [aliasId]
    );
  });
}
