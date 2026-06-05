import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdate = vi.fn();
const mockAuditInsert = vi.fn().mockResolvedValue({ error: null });
let mockExistingRow: Record<string, unknown> | null = { status: 'active' };
let mockUpdatedRow: Record<string, unknown> | null = { id: 'rel-1', mute_policy: 'silent' };

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
  }),
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'identities') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ single: () => Promise.resolve({ data: mockExistingRow, error: mockExistingRow ? null : { message: 'nf' } }) }),
            }),
          }),
          update: mockUpdate.mockReturnValue({
            eq: () => ({
              eq: () => ({
                select: () => ({ single: () => Promise.resolve({ data: mockUpdatedRow, error: mockUpdatedRow ? null : { message: 'nf' } }) }),
              }),
            }),
          }),
        };
      }
      if (table === 'audit_log') return { insert: mockAuditInsert };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { PATCH } from '../app/api/v2/identities/[id]/mute/route';

function req(body: unknown) {
  return new Request('http://localhost/api/v2/identities/rel-1/mute', {
    method: 'PATCH',
    headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockUpdate.mockClear();
  mockAuditInsert.mockClear();
  mockExistingRow = { status: 'active' };
  mockUpdatedRow = { id: 'rel-1', mute_policy: 'silent' };
});

describe('PATCH /api/v2/identities/[id]/mute', () => {
  it('rejects an invalid policy', async () => {
    const res = await PATCH(req({ mute_policy: 'loud' }), { params: { id: 'rel-1' } });
    expect(res.status).toBe(400);
  });

  it('updates the mute policy', async () => {
    const res = await PATCH(req({ mute_policy: 'silent' }), { params: { id: 'rel-1' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'rel-1', mute_policy: 'silent' });
    expect(mockUpdate.mock.calls[0][0]).toEqual({ mute_policy: 'silent' });
    expect(mockAuditInsert).toHaveBeenCalled();
  });

  it('404s when the relationship is missing', async () => {
    mockExistingRow = null;
    const res = await PATCH(req({ mute_policy: 'all' }), { params: { id: 'rel-1' } });
    expect(res.status).toBe(404);
  });

  it('409s when the relationship is already retired', async () => {
    mockExistingRow = { status: 'retired' };
    const res = await PATCH(req({ mute_policy: 'all' }), { params: { id: 'rel-1' } });
    expect(res.status).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
