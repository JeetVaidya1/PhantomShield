import { describe, it, expect, vi, beforeEach } from 'vitest';

const UUID1 = '550e8400-e29b-41d4-a716-446655440001';
const UUID2 = '550e8400-e29b-41d4-a716-446655440002';
const UUID3 = '550e8400-e29b-41d4-a716-446655440003';
const UUID_HP = '550e8400-e29b-41d4-a716-446655440004';
const UUID_BAD = '550e8400-e29b-41d4-a716-446655440999';

const mockInsertScan = vi.fn();
const mockInsertAudit = vi.fn().mockResolvedValue({ error: null });
const mockUpdateIdentity = vi.fn();

let mockIdentities = [
  { id: UUID1, alias_email: 'a@test.com', service_label: 'Netflix', type: 'email', is_honeypot: false, status: 'active', created_at: '2025-01-01' },
  { id: UUID2, alias_email: 'b@test.com', service_label: 'Spotify', type: 'email', is_honeypot: false, status: 'active', created_at: '2025-01-01' },
  { id: UUID3, alias_email: null, service_label: 'Uber', type: 'phone', is_honeypot: false, status: 'active', created_at: '2025-01-01' },
  { id: UUID_HP, alias_email: 'hp@test.com', service_label: 'Trap', type: 'email', is_honeypot: true, status: 'active', created_at: '2025-01-01' },
];

let mockEmailCount = 0;
let mockSmsCount = 0;
let mockLatestScan: any = null;

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
              eq: (_f2: string, _v2: string) => {
                // For scan route: identities list
                if (_f === 'user_id' && _f2 === 'status') {
                  return Promise.resolve({ data: mockIdentities, error: null });
                }
                // For kill route: update identity
                return Promise.resolve({ data: null, error: null });
              },
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
      if (table === 'email_summaries') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => Promise.resolve({ count: mockEmailCount }),
            }),
          }),
        };
      }
      if (table === 'sms_messages') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => Promise.resolve({ count: mockSmsCount }),
            }),
          }),
        };
      }
      if (table === 'autopilot_scans') {
        return {
          insert: mockInsertScan.mockReturnValue({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: 'scan-1', stale_count: 3, total_scanned: 3 },
                  error: null,
                }),
            }),
          }),
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  single: () => Promise.resolve({
                    data: mockLatestScan,
                    error: mockLatestScan ? null : { message: 'not found' },
                  }),
                }),
              }),
            }),
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

import { POST as scanPost } from '../app/api/v2/autopilot/scan/route';
import { GET as resultsGet } from '../app/api/v2/autopilot/results/route';
import { POST as killPost } from '../app/api/v2/autopilot/kill/route';

describe('v2-029: Privacy autopilot scan engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmailCount = 0;
    mockSmsCount = 0;
    mockLatestScan = null;
  });

  describe('POST /api/v2/autopilot/scan', () => {
    it('identifies stale aliases with no emails in 90 days', async () => {
      mockEmailCount = 0; // No emails
      mockSmsCount = 0;

      const req = new Request('http://localhost/api/v2/autopilot/scan', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = await scanPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      // Should flag id-1, id-2 (email aliases with no emails) and id-3 (phone with no SMS)
      // Should NOT flag id-hp (honeypot)
      expect(data.stale_count).toBe(3);
      expect(data.total_scanned).toBe(3); // Excludes honeypot
    });

    it('does NOT flag identities with recent activity', async () => {
      mockEmailCount = 5;
      mockSmsCount = 3;

      const req = new Request('http://localhost/api/v2/autopilot/scan', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = await scanPost(req);
      const data = await res.json();
      expect(data.stale_count).toBe(0);
    });

    it('stores results in autopilot_scans', async () => {
      const req = new Request('http://localhost/api/v2/autopilot/scan', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
      });
      await scanPost(req);
      expect(mockInsertScan).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
        })
      );
    });

    it('logs to audit_log', async () => {
      const req = new Request('http://localhost/api/v2/autopilot/scan', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
      });
      await scanPost(req);
      expect(mockInsertAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'autopilot_scan',
        })
      );
    });

    it('requires authentication', async () => {
      const req = new Request('http://localhost/api/v2/autopilot/scan', {
        method: 'POST',
      });
      const res = await scanPost(req);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v2/autopilot/results', () => {
    it('returns latest scan results', async () => {
      mockLatestScan = { id: 'scan-1', stale_count: 2, total_scanned: 5 };
      const req = new Request('http://localhost/api/v2/autopilot/results', {
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = await resultsGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.scan.id).toBe('scan-1');
    });

    it('returns 404 if no scan exists', async () => {
      mockLatestScan = null;
      const req = new Request('http://localhost/api/v2/autopilot/results', {
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = await resultsGet(req);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v2/autopilot/kill', () => {
    it('deactivates identities from latest scan', async () => {
      mockLatestScan = {
        id: 'scan-1',
        stale_identities: [
          { identity_id: UUID1, reason: 'stale' },
          { identity_id: UUID2, reason: 'stale' },
        ],
      };

      const req = new Request('http://localhost/api/v2/autopilot/kill', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ identity_ids: [UUID1, UUID2] }),
      });
      const res = await killPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.killed_count).toBe(2);
    });

    it('deactivates any user-owned identities when scan exists', async () => {
      mockLatestScan = {
        id: 'scan-1',
      };

      const req = new Request('http://localhost/api/v2/autopilot/kill', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ identity_ids: [UUID1, UUID_BAD] }),
      });
      const res = await killPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.requested_count).toBe(2);
    });

    it('requires a scan to exist first', async () => {
      mockLatestScan = null;
      const req = new Request('http://localhost/api/v2/autopilot/kill', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ identity_ids: [UUID1] }),
      });
      const res = await killPost(req);
      expect(res.status).toBe(400);
    });

    it('logs kill to audit_log', async () => {
      mockLatestScan = {
        id: 'scan-1',
        stale_identities: [{ identity_id: UUID1, reason: 'stale' }],
      };

      const req = new Request('http://localhost/api/v2/autopilot/kill', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ identity_ids: [UUID1] }),
      });
      await killPost(req);
      expect(mockInsertAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'autopilot_kill',
        })
      );
    });

    it('validates input with Zod', async () => {
      const req = new Request('http://localhost/api/v2/autopilot/kill', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ identity_ids: ['not-a-uuid'] }),
      });
      const res = await killPost(req);
      expect(res.status).toBe(400);
    });
  });
});
