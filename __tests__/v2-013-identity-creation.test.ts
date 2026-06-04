import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Mocks ---------------------------------------------------------------
const insertSpy = vi.fn();
const updateSpy = vi.fn();
let insertedRow: Record<string, unknown> = {};
let killRow: Record<string, unknown> | null = { id: 'id-1', simplelogin_alias_id: 555, alias_email: 'x@a.com', service_label: 'X' };

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
  }),
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'identities') {
        return {
          // count query (free-tier check)
          select: (_c?: unknown, opts?: { head?: boolean }) => {
            if (opts?.head) {
              return {
                eq: () => ({ eq: () => ({ eq: () => ({ neq: () => Promise.resolve({ count: 0, error: null }) }) }) }),
              };
            }
            return { eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
          },
          insert: (row: Record<string, unknown>) => {
            insertSpy(row);
            insertedRow = row;
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'new-id', ...row }, error: null }) }) };
          },
          update: (patch: Record<string, unknown>) => {
            updateSpy(patch);
            return { eq: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: killRow, error: killRow ? null : { message: 'not found' } }) }) }) }) };
          },
        };
      }
      if (table === 'alias_domains') {
        return { select: () => ({ eq: () => ({ eq: () => ({ lt: () => ({ order: () => Promise.resolve({ data: [{ id: 'dom-1', domain: 'shield.com', active: true, blocked_count: 0, mx_verified: true }], error: null }) }) }) }) }) };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    },
  }),
}));

const createAliasMock = vi.fn().mockResolvedValue({ simpleloginAliasId: 9001, aliasEmail: 'gen@shield.com', mailboxId: 1 });
const deactivateAliasMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../lib/email/alias-sync', () => ({
  createAlias: (...args: unknown[]) => createAliasMock(...args),
  deactivateAlias: (...args: unknown[]) => deactivateAliasMock(...args),
}));

import { POST } from '../app/api/v2/aliases/route';
import { DELETE } from '../app/api/v2/aliases/[id]/route';
import { resetStore } from '../lib/rate-limit';

function req(body?: unknown) {
  return new Request('http://localhost/api/v2/aliases', {
    method: 'POST',
    headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('v2-013: Identity creation uses multi-domain + SimpleLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    insertedRow = {};
    killRow = { id: 'id-1', simplelogin_alias_id: 555, alias_email: 'x@a.com', service_label: 'X' };
  });
  afterEach(() => vi.unstubAllEnvs());

  it('with SimpleLogin enabled: creates SL alias and stores domain_id + simplelogin_alias_id', async () => {
    vi.stubEnv('SIMPLELOGIN_DB_URI', 'postgresql://sl');
    const res = await POST(req({ label: 'Shop', service_label: 'Amazon', forwarding_email: 'me@gmail.com' }));
    expect(res.status).toBe(201);

    expect(createAliasMock).toHaveBeenCalledWith('user-123', expect.stringContaining('@shield.com'), 'me@gmail.com');
    expect(insertedRow.domain_id).toBe('dom-1');
    expect(insertedRow.simplelogin_alias_id).toBe(9001);
    // Alias format: word-randomchars@domain
    expect(String(insertedRow.alias_email)).toMatch(/^[a-z]+-[0-9a-f]{8}@shield\.com$/);
  });

  it('without SimpleLogin: falls back to phantomdefender.com, no bridge call', async () => {
    const res = await POST(req({ label: 'Shop', service_label: 'Amazon', forwarding_email: 'me@gmail.com' }));
    expect(res.status).toBe(201);
    expect(createAliasMock).not.toHaveBeenCalled();
    expect(String(insertedRow.alias_email)).toContain('@phantomdefender.com');
    expect(insertedRow.domain_id).toBeNull();
  });

  it('kill deactivates the SimpleLogin alias when configured', async () => {
    vi.stubEnv('SIMPLELOGIN_DB_URI', 'postgresql://sl');
    const delReq = new Request('http://localhost/api/v2/aliases/id-1', {
      method: 'DELETE',
      headers: { authorization: 'Bearer valid' },
    });
    const res = await DELETE(delReq, { params: { id: 'id-1' } });
    expect(res.status).toBe(200);
    expect(deactivateAliasMock).toHaveBeenCalledWith(555);
  });
});
