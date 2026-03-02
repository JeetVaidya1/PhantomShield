import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpsert = vi.fn().mockResolvedValue({ error: null });

let mockIdentities: any[] = [];
let mockLeakCount = 0;
let mockScoreData: any = null;

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
            not: () =>
              Promise.resolve({ data: mockIdentities, error: null }),
          }),
        };
      }
      if (table === 'leak_detections') {
        return {
          select: () => ({
            in: () => Promise.resolve({ count: mockLeakCount }),
          }),
        };
      }
      if (table === 'company_privacy_scores') {
        return {
          upsert: mockUpsert,
          select: () => ({
            eq: (_f: string, _v: string) => ({
              single: () =>
                Promise.resolve({
                  data: mockScoreData,
                  error: mockScoreData ? null : { message: 'not found' },
                }),
            }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    },
  }),
}));

const CRON_SECRET = 'test-cron-secret-123';
vi.stubEnv('CRON_SECRET', CRON_SECRET);

import { POST as cronPost } from '../app/api/cron/company-scores/route';
import { GET as scoreGet } from '../app/api/v2/company-scores/[domain]/route';

describe('v2-032: Company privacy scores computation and API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIdentities = [];
    mockLeakCount = 0;
    mockScoreData = null;
  });

  describe('POST /api/cron/company-scores', () => {
    it('verifies CRON_SECRET', async () => {
      const req = new Request('http://localhost/api/cron/company-scores', {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-secret' },
      });
      const res = await cronPost(req);
      expect(res.status).toBe(401);
    });

    it('computes score: 100 aliases and 5 leaks → score 95', async () => {
      // Create 100 identities labeled "netflix"
      mockIdentities = Array.from({ length: 100 }, (_, i) => ({
        id: `id-${i}`,
        service_label: 'Netflix',
      }));
      mockLeakCount = 5;

      const req = new Request('http://localhost/api/cron/company-scores', {
        method: 'POST',
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      });
      const res = await cronPost(req);
      expect(res.status).toBe(200);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          company_domain: 'netflix',
          total_aliases: 100,
          leak_detections: 5,
          privacy_score: 95,
        }),
        expect.anything()
      );
    });

    it('skips companies with < 10 aliases (insufficient data)', async () => {
      mockIdentities = Array.from({ length: 3 }, (_, i) => ({
        id: `id-${i}`,
        service_label: 'TinyCompany',
      }));

      const req = new Request('http://localhost/api/cron/company-scores', {
        method: 'POST',
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      });
      const res = await cronPost(req);
      const data = await res.json();
      expect(data.skipped).toBe(1);
      expect(data.computed).toBe(0);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('no individual user data exposed (only aggregates)', async () => {
      mockIdentities = Array.from({ length: 20 }, (_, i) => ({
        id: `id-${i}`,
        service_label: 'Google',
      }));
      mockLeakCount = 2;

      const req = new Request('http://localhost/api/cron/company-scores', {
        method: 'POST',
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      });
      await cronPost(req);

      // Verify upsert data doesn't contain user IDs
      const upsertArg = mockUpsert.mock.calls[0][0];
      expect(upsertArg).not.toHaveProperty('user_id');
      expect(upsertArg).not.toHaveProperty('user_ids');
    });
  });

  describe('GET /api/v2/company-scores/:domain', () => {
    it('returns score for known company (public endpoint, no auth)', async () => {
      mockScoreData = {
        company_domain: 'google',
        company_name: 'google',
        privacy_score: 92,
        leak_rate: 0.08,
        total_aliases: 50,
        leak_detections: 4,
        last_computed_at: '2026-03-01T00:00:00Z',
      };

      const req = new Request('http://localhost/api/v2/company-scores/google', {
        headers: {},
      });
      const res = await scoreGet(req, { params: { domain: 'google' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.privacy_score).toBe(92);
      expect(data.leak_rate).toBe(0.08);
    });

    it('returns insufficient_data for companies below threshold', async () => {
      mockScoreData = {
        company_domain: 'tiny',
        company_name: 'tiny',
        privacy_score: 50,
        leak_rate: 0.5,
        total_aliases: 3,
        leak_detections: 1,
        last_computed_at: '2026-03-01T00:00:00Z',
      };

      const req = new Request('http://localhost/api/v2/company-scores/tiny', {
        headers: {},
      });
      const res = await scoreGet(req, { params: { domain: 'tiny' } });
      const data = await res.json();
      expect(data.status).toBe('insufficient_data');
    });

    it('returns 404 for unknown company', async () => {
      mockScoreData = null;
      const req = new Request('http://localhost/api/v2/company-scores/unknown', {
        headers: {},
      });
      const res = await scoreGet(req, { params: { domain: 'unknown' } });
      expect(res.status).toBe(404);
    });

    it('response is cached (Cache-Control: max-age=86400)', async () => {
      mockScoreData = {
        company_domain: 'cached',
        company_name: 'cached',
        privacy_score: 85,
        leak_rate: 0.15,
        total_aliases: 100,
        leak_detections: 15,
        last_computed_at: '2026-03-01T00:00:00Z',
      };

      const req = new Request('http://localhost/api/v2/company-scores/cached', {
        headers: {},
      });
      const res = await scoreGet(req, { params: { domain: 'cached' } });
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
    });
  });
});
