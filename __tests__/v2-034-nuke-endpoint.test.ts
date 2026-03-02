import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdateIdentity = vi.fn();
const mockInsertDeletion = vi.fn().mockResolvedValue({ error: null });
const mockUpdateProfile = vi.fn();
const mockInsertAudit = vi.fn().mockResolvedValue({ error: null });

let mockIdentities = [
  { id: 'id-1', alias_email: 'a@phantomdefender.com', service_label: 'Netflix', type: 'email', status: 'active' },
  { id: 'id-2', alias_email: 'b@phantomdefender.com', service_label: 'Spotify', type: 'email', status: 'active' },
  { id: 'id-3', alias_email: null, service_label: null, type: 'phone', status: 'active' },
];

let mockContact: any = { privacy_email: 'privacy@company.com' };

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      }),
    },
  }),
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'identities') {
        return {
          select: () => ({
            eq: (_f: string, _v: string) => ({
              eq: (_f2: string, _v2: string) =>
                Promise.resolve({ data: mockIdentities, error: null }),
            }),
          }),
          update: mockUpdateIdentity.mockReturnValue({
            eq: (_f: string, _v: string) => ({
              eq: (_f2: string, _v2: string) =>
                Promise.resolve({ error: null }),
            }),
          }),
        };
      }
      if (table === 'company_privacy_contacts') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockContact, error: null }),
            }),
          }),
        };
      }
      if (table === 'deletion_requests') {
        return { insert: mockInsertDeletion };
      }
      if (table === 'user_profiles') {
        return {
          update: mockUpdateProfile.mockReturnValue({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      if (table === 'audit_log') {
        return { insert: mockInsertAudit };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    },
  }),
}));

import { POST } from '../app/api/v2/nuke/route';
import { resetStore } from '../lib/rate-limit';

describe('v2-034: Emergency nuke API endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockContact = { privacy_email: 'privacy@company.com' };
  });

  it('kills all identities and sends GDPR emails', async () => {
    const req = new Request('http://localhost/api/v2/nuke', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        'x-biometric-token': 'biometric-verified',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ confirm: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.identities_killed).toBe(3);
    expect(data.gdpr_emails_sent).toBe(2); // Only 2 have service_label + alias_email
    expect(data.recovery_deadline).toBeDefined();
  });

  it('returns 403 without biometric token', async () => {
    const req = new Request('http://localhost/api/v2/nuke', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ confirm: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 429 on second nuke within 24 hours', async () => {
    // First nuke
    const req1 = new Request('http://localhost/api/v2/nuke', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        'x-biometric-token': 'biometric-verified',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ confirm: true }),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);

    // Second nuke
    const req2 = new Request('http://localhost/api/v2/nuke', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        'x-biometric-token': 'biometric-verified',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ confirm: true }),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(429);
  });

  it('logs emergency_nuke to audit_log', async () => {
    const req = new Request('http://localhost/api/v2/nuke', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        'x-biometric-token': 'biometric-verified',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ confirm: true }),
    });
    await POST(req);
    expect(mockInsertAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'emergency_nuke',
        metadata: expect.objectContaining({
          identities_killed: 3,
          gdpr_emails_sent: 2,
        }),
      })
    );
  });

  it('soft-deletes user profile (sets deleted_at)', async () => {
    const req = new Request('http://localhost/api/v2/nuke', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        'x-biometric-token': 'biometric-verified',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ confirm: true }),
    });
    await POST(req);
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
      })
    );
  });

  it('requires confirm: true in body', async () => {
    const req = new Request('http://localhost/api/v2/nuke', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        'x-biometric-token': 'biometric-verified',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ confirm: false }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const req = new Request('http://localhost/api/v2/nuke', {
      method: 'POST',
      headers: {
        'x-biometric-token': 'biometric-verified',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ confirm: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns recovery deadline 30 days from now', async () => {
    const req = new Request('http://localhost/api/v2/nuke', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        'x-biometric-token': 'biometric-verified',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ confirm: true }),
    });
    const res = await POST(req);
    const data = await res.json();
    const deadline = new Date(data.recovery_deadline);
    const now = new Date();
    const diffDays = Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });
});
