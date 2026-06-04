import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * A thenable Supabase query-builder mock: every chain method returns `this`,
 * and awaiting (or calling .single()) resolves to the configured result for
 * that table. Each test wires up `tableResults` per table name.
 */
let tableResults: Record<string, { data?: unknown; error?: unknown }> = {};
const updateSpy = vi.fn();

function makeBuilder(table: string) {
  const result = tableResults[table] ?? { data: null, error: null };
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'lt', 'order', 'insert']) {
    builder[m] = () => builder;
  }
  builder.update = (patch: unknown) => {
    updateSpy(table, patch);
    return builder;
  };
  builder.single = () => Promise.resolve(result);
  builder.then = (onResolved: (v: unknown) => unknown) => Promise.resolve(result).then(onResolved);
  return builder;
}

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
    },
  }),
  getSupabaseServiceClient: () => ({ from: (t: string) => makeBuilder(t) }),
}));

import { selectDomainForNewAlias, getActiveDomains } from '../lib/email/domains';
import { getSupabaseServiceClient } from '../lib/supabase';
import { GET } from '../app/api/v2/domains/route';
import { POST as reportBlocked } from '../app/api/v2/domains/[id]/report-blocked/route';
import { resetStore } from '../lib/rate-limit';

const UUID_A = '550e8400-e29b-41d4-a716-446655440aaa';
const UUID_B = '550e8400-e29b-41d4-a716-446655440bbb';
const UUID_C = '550e8400-e29b-41d4-a716-446655440ccc';

function authedReq(url: string, method = 'GET', body?: unknown) {
  return new Request(url, {
    method,
    headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('v2-012: Multi-domain management', () => {
  beforeEach(() => {
    tableResults = {};
    updateSpy.mockClear();
    resetStore();
  });
  afterEach(() => vi.unstubAllEnvs());

  describe('selectDomainForNewAlias', () => {
    it('prefers a domain the user does not already have aliases on', async () => {
      tableResults = {
        alias_domains: {
          data: [
            { id: UUID_A, domain: 'a.com', active: true, blocked_count: 0, mx_verified: true },
            { id: UUID_B, domain: 'b.com', active: true, blocked_count: 0, mx_verified: true },
            { id: UUID_C, domain: 'c.com', active: true, blocked_count: 0, mx_verified: true },
          ],
        },
        identities: { data: [{ domain_id: UUID_A }, { domain_id: UUID_B }] },
      };
      const supabase = getSupabaseServiceClient();
      const chosen = await selectDomainForNewAlias(supabase as never, 'user-123');
      expect(chosen.id).toBe(UUID_C);
    });

    it('throws a clear error when all domains are blocked/unavailable', async () => {
      tableResults = { alias_domains: { data: [] }, identities: { data: [] } };
      const supabase = getSupabaseServiceClient();
      await expect(selectDomainForNewAlias(supabase as never, 'user-123')).rejects.toThrow(
        /No alias domains available/
      );
    });

    it('getActiveDomains throws on db error', async () => {
      tableResults = { alias_domains: { error: { message: 'boom' } } };
      const supabase = getSupabaseServiceClient();
      await expect(getActiveDomains(supabase as never)).rejects.toThrow(/Failed to load/);
    });
  });

  describe('GET /api/v2/domains', () => {
    it('requires auth', async () => {
      const res = await GET(new Request('http://localhost/api/v2/domains'));
      expect(res.status).toBe(401);
    });

    it('returns active domains for an authed user', async () => {
      tableResults = {
        alias_domains: { data: [{ id: UUID_A, domain: 'a.com', active: true, blocked_count: 0, mx_verified: true }] },
      };
      const res = await GET(authedReq('http://localhost/api/v2/domains'));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.domains).toEqual([{ id: UUID_A, domain: 'a.com' }]);
    });
  });

  describe('POST report-blocked', () => {
    it('rejects an invalid (non-uuid) domain id', async () => {
      const res = await reportBlocked(authedReq('http://localhost/x', 'POST'), { params: { id: 'not-a-uuid' } });
      expect(res.status).toBe(400);
    });

    it('increments blocked_count below threshold without deactivating', async () => {
      tableResults = { alias_domains: { data: { id: UUID_A, blocked_count: 3, active: true }, error: null } };
      const res = await reportBlocked(authedReq('http://localhost/x', 'POST'), { params: { id: UUID_A } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.blocked_count).toBe(4);
      expect(json.deactivated).toBe(false);
      expect(updateSpy).toHaveBeenCalledWith('alias_domains', { blocked_count: 4 });
    });

    it('auto-deactivates the domain at the threshold of 10', async () => {
      tableResults = { alias_domains: { data: { id: UUID_A, blocked_count: 9, active: true }, error: null } };
      const res = await reportBlocked(authedReq('http://localhost/x', 'POST'), { params: { id: UUID_A } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.blocked_count).toBe(10);
      expect(json.deactivated).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith('alias_domains', { blocked_count: 10, active: false });
    });
  });
});
