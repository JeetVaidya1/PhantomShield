import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIdentityUpdate = vi.fn();
const mockDeletionInsert = vi.fn().mockResolvedValue({ error: null });
const mockAuditInsert = vi.fn().mockResolvedValue({ error: null });

let mockIdentity: Record<string, unknown> | null = {
  id: 'rel-1',
  alias_email: 'x@phantomdefender.com',
  service_label: 'Store',
  vendor_domain: 'store.com',
  type: 'email',
  status: 'active',
  simplelogin_alias_id: null,
};
let mockContact: { privacy_email: string } | null = { privacy_email: 'privacy@store.com' };

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-9' } },
        error: null,
      }),
    },
  }),
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'identities') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockIdentity, error: null }),
              }),
            }),
          }),
          update: mockIdentityUpdate.mockReturnValue({
            eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
          }),
        };
      }
      if (table === 'company_privacy_contacts') {
        return {
          select: () => ({
            eq: () => ({ single: () => Promise.resolve({ data: mockContact, error: null }) }),
          }),
        };
      }
      if (table === 'deletion_requests') {
        return { insert: mockDeletionInsert };
      }
      if (table === 'audit_log') {
        return { insert: mockAuditInsert };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from '../app/api/v2/identities/[id]/retire/route';

function req(body: unknown) {
  return new Request('http://localhost/api/v2/identities/rel-1/retire', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  delete process.env.SIMPLELOGIN_DB_URI;
  mockIdentity = {
    id: 'rel-1',
    alias_email: 'x@phantomdefender.com',
    service_label: 'Store',
    vendor_domain: 'store.com',
    type: 'email',
    status: 'active',
    simplelogin_alias_id: null,
  };
  mockContact = { privacy_email: 'privacy@store.com' };
  mockIdentityUpdate.mockClear();
  mockDeletionInsert.mockClear();
  mockAuditInsert.mockClear();
});

describe('POST /api/v2/identities/[id]/retire', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await POST(
      new Request('http://localhost/x', { method: 'POST', body: '{}' }),
      { params: { id: 'rel-1' } }
    );
    expect(res.status).toBe(401);
  });

  it('rejects an invalid mode', async () => {
    const res = await POST(req({ mode: 'nope' }), { params: { id: 'rel-1' } });
    expect(res.status).toBe(400);
  });

  it('kills a relationship and records the erasure', async () => {
    const res = await POST(req({ mode: 'kill' }), { params: { id: 'rel-1' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ retired: true, mode: 'kill', status: 'killed', gdpr_request_recorded: true });
    expect(mockIdentityUpdate.mock.calls[0][0].status).toBe('killed');
    expect(mockDeletionInsert).toHaveBeenCalledOnce();
    expect(mockAuditInsert).toHaveBeenCalled();
  });

  it('retires as a honeypot tripwire', async () => {
    const res = await POST(req({ mode: 'honeypot' }), { params: { id: 'rel-1' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('retired');
    expect(mockIdentityUpdate.mock.calls[0][0].is_honeypot).toBe(true);
  });

  it('404s when the relationship is not the user\'s', async () => {
    mockIdentity = null;
    const res = await POST(req({ mode: 'kill' }), { params: { id: 'rel-1' } });
    expect(res.status).toBe(404);
  });

  it('409s when already killed', async () => {
    mockIdentity = { ...(mockIdentity as object), status: 'killed' };
    const res = await POST(req({ mode: 'kill' }), { params: { id: 'rel-1' } });
    expect(res.status).toBe(409);
  });
});
