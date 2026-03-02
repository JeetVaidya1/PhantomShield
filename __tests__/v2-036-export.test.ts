import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsertAudit = vi.fn().mockResolvedValue({ error: null });
const mockIdentities = [
  { id: 'id-1', alias_email: 'a@pd.com', service_label: 'Netflix', domain: 'phantomdefender.com', type: 'email', status: 'active', is_honeypot: false, created_at: '2026-01-01' },
  { id: 'id-2', alias_email: 'b@pd.com', service_label: 'Spotify', domain: 'phantomdefender.com', type: 'email', status: 'active', is_honeypot: false, created_at: '2026-01-15' },
];

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
        return { select: () => ({ eq: () => Promise.resolve({ data: mockIdentities, error: null }) }) };
      }
      if (table === 'tracker_stats') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      }
      if (table === 'leak_detections') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      }
      if (table === 'deletion_requests') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      }
      if (table === 'audit_log') {
        return { insert: mockInsertAudit };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
    },
  }),
}));

import { GET } from '../app/api/v2/export/route';

describe('v2-036: Portable data export', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns JSON with all user identities', async () => {
    const req = new Request('http://localhost/api/v2/export', {
      headers: { authorization: 'Bearer valid-token', 'x-biometric-token': 'bio' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.identities).toHaveLength(2);
    expect(data.identities[0].alias_email).toBe('a@pd.com');
  });

  it('returns 403 without biometric token', async () => {
    const req = new Request('http://localhost/api/v2/export', {
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('includes SimpleLogin-compatible alias format', async () => {
    const req = new Request('http://localhost/api/v2/export', {
      headers: { authorization: 'Bearer valid-token', 'x-biometric-token': 'bio' },
    });
    const res = await GET(req);
    const data = await res.json();
    expect(data.simplelogin_compatible.aliases).toHaveLength(2);
    expect(data.simplelogin_compatible.aliases[0]).toHaveProperty('alias');
    expect(data.simplelogin_compatible.aliases[0]).toHaveProperty('enabled');
  });

  it('CSV format returns valid CSV', async () => {
    const req = new Request('http://localhost/api/v2/export?format=csv', {
      headers: { authorization: 'Bearer valid-token', 'x-biometric-token': 'bio' },
    });
    const res = await GET(req);
    expect(res.headers.get('Content-Type')).toBe('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('phantom-defender-export.csv');
    const text = await res.text();
    const lines = text.split('\n');
    expect(lines[0]).toContain('alias_email');
    expect(lines.length).toBe(3); // header + 2 rows
  });

  it('logs data_exported to audit_log', async () => {
    const req = new Request('http://localhost/api/v2/export', {
      headers: { authorization: 'Bearer valid-token', 'x-biometric-token': 'bio' },
    });
    await GET(req);
    expect(mockInsertAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'data_exported' })
    );
  });

  it('does NOT include encryption keys or password hash', async () => {
    const req = new Request('http://localhost/api/v2/export', {
      headers: { authorization: 'Bearer valid-token', 'x-biometric-token': 'bio' },
    });
    const res = await GET(req);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('master_password');
    expect(text).not.toContain('encryption_key');
    expect(text).not.toContain('biometric');
  });
});
