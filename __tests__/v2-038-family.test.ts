import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * FIFO queue-per-table mock: each terminal operation (single/maybeSingle/await/
 * insert/update/delete) shifts the next configured result for that table. Tests
 * enqueue results in the exact order the route consumes them.
 */
const queues: Record<string, Array<{ data?: unknown; error?: unknown; count?: number }>> = {};
const captures: Array<{ table: string; op: string; arg?: unknown }> = [];

function enqueue(table: string, ...results: Array<{ data?: unknown; error?: unknown; count?: number }>) {
  (queues[table] ??= []).push(...results);
}
function nextResult(table: string) {
  return (queues[table] ??= []).shift() ?? { data: null, error: null };
}

function builder(table: string) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'gte', 'lt']) {
    b[m] = () => b;
  }
  b.single = () => Promise.resolve(nextResult(table));
  b.maybeSingle = () => Promise.resolve(nextResult(table));
  b.then = (res: (v: unknown) => unknown) => Promise.resolve(nextResult(table)).then(res);
  b.insert = (row: unknown) => {
    captures.push({ table, op: 'insert', arg: row });
    return builder(table);
  };
  b.update = (patch: unknown) => {
    captures.push({ table, op: 'update', arg: patch });
    return builder(table);
  };
  b.delete = () => {
    captures.push({ table, op: 'delete' });
    return builder(table);
  };
  return b;
}

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner-1' } }, error: null }) },
  }),
  getSupabaseServiceClient: () => ({ from: (t: string) => builder(t) }),
}));

import { POST as createFamily } from '../app/api/v2/family/route';
import { POST as invite } from '../app/api/v2/family/invite/route';
import { GET as stats } from '../app/api/v2/family/stats/route';
import { DELETE as removeMember } from '../app/api/v2/family/members/[id]/route';
import { resetStore } from '../lib/rate-limit';

const authed = (method: string, body?: unknown) =>
  new Request('http://localhost/x', {
    method,
    headers: { authorization: 'Bearer v', 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

describe('v2-038: Family plan API', () => {
  beforeEach(() => {
    for (const k of Object.keys(queues)) delete queues[k];
    captures.length = 0;
    resetStore();
  });
  afterEach(() => vi.unstubAllEnvs());

  describe('POST /api/v2/family', () => {
    it('creates a family with the caller as owner', async () => {
      enqueue('families', { data: null }); // no existing family
      enqueue('families', { data: { id: 'fam-1', max_members: 5 }, error: null }); // insert .select().single()
      const res = await createFamily(authed('POST'));
      expect(res.status).toBe(201);
      const ownerMember = captures.find((c) => c.table === 'family_members' && c.op === 'insert');
      expect(ownerMember?.arg).toMatchObject({ role: 'owner', user_id: 'owner-1' });
    });

    it('rejects a second family for the same owner', async () => {
      enqueue('families', { data: { id: 'fam-1' } }); // already exists
      const res = await createFamily(authed('POST'));
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/v2/family/invite', () => {
    it('owner invites a member by email (pending record)', async () => {
      enqueue('families', { data: { id: 'fam-1', max_members: 5 } }); // owns family
      enqueue('family_members', { count: 1 }); // member count
      const res = await invite(authed('POST', { email: 'kid@example.com' }));
      expect(res.status).toBe(201);
      const inv = captures.find((c) => c.table === 'family_members' && c.op === 'insert');
      expect(inv?.arg).toMatchObject({ invite_email: 'kid@example.com', status: 'pending' });
    });

    it('rejects an invalid email', async () => {
      const res = await invite(authed('POST', { email: 'not-an-email' }));
      expect(res.status).toBe(400);
    });

    it('rejects when the caller does not own a family', async () => {
      enqueue('families', { data: null });
      const res = await invite(authed('POST', { email: 'x@y.com' }));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v2/family/stats', () => {
    it('returns only aggregate numbers, never individual data', async () => {
      enqueue('family_members', { data: { family_id: 'fam-1' } }); // membership
      enqueue('family_members', { data: [{ user_id: 'owner-1' }, { user_id: 'member-2' }] }); // members
      enqueue('tracker_logs', { data: [{ trackers_stripped: 10 }, { trackers_stripped: 5 }] });
      enqueue('identities', { count: 7 });
      enqueue('leak_detections', { count: 2 });

      const res = await stats(authed('GET'));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.stats).toEqual({
        total_trackers_blocked: 15,
        total_aliases: 7,
        total_leaks: 2,
        member_count: 2,
      });
      // No alias/email/identity detail keys leak through.
      expect(JSON.stringify(json)).not.toMatch(/alias_email|forwarding_email|service_label/);
    });
  });

  describe('DELETE /api/v2/family/members/:id', () => {
    it('lets the owner remove a member', async () => {
      enqueue('family_members', { data: { id: 'm-2', family_id: 'fam-1', user_id: 'member-2', role: 'member' } });
      enqueue('families', { data: { id: 'fam-1', owner_id: 'owner-1' } });
      const res = await removeMember(authed('DELETE'), { params: { id: 'm-2' } });
      expect(res.status).toBe(200);
      expect(captures.find((c) => c.table === 'family_members' && c.op === 'delete')).toBeTruthy();
    });

    it('forbids a non-owner from removing members', async () => {
      enqueue('family_members', { data: { id: 'm-2', family_id: 'fam-1', user_id: 'member-2', role: 'member' } });
      enqueue('families', { data: { id: 'fam-1', owner_id: 'someone-else' } });
      const res = await removeMember(authed('DELETE'), { params: { id: 'm-2' } });
      expect(res.status).toBe(403);
    });

    it('prevents the owner from removing themselves', async () => {
      enqueue('family_members', { data: { id: 'm-1', family_id: 'fam-1', user_id: 'owner-1', role: 'owner' } });
      enqueue('families', { data: { id: 'fam-1', owner_id: 'owner-1' } });
      const res = await removeMember(authed('DELETE'), { params: { id: 'm-1' } });
      expect(res.status).toBe(400);
    });
  });
});
