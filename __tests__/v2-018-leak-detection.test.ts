import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkForLeak,
  matchesSenderDomain,
  isInfrastructureDomain,
} from '../lib/email/leak-detector';

// Mock supabase for API tests
let mockLeaks: any[] = [];
const mockUpdate = vi.fn().mockImplementation(() => ({
  eq: (_f: string, _v: string) => ({
    eq: (_f2: string, _v2: string) => ({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: { id: 'leak-1', dismissed: true },
            error: null,
          }),
      }),
    }),
  }),
}));

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
    from: (table: string) => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: () => ({
        eq: (_f: string, _v: any) => ({
          eq: (_f2: string, _v2: any) => ({
            order: () =>
              Promise.resolve({ data: mockLeaks, error: null }),
          }),
        }),
      }),
      update: mockUpdate,
    }),
  }),
}));

import { GET } from '../app/api/v2/leaks/route';
import { PATCH } from '../app/api/v2/leaks/[id]/dismiss/route';

describe('v2-018: Leak detection engine', () => {
  beforeEach(() => {
    mockLeaks = [];
    vi.clearAllMocks();
  });

  describe('checkForLeak', () => {
    it('email from vitamins.com to Netflix-labeled alias → leak detected', () => {
      const result = checkForLeak({
        serviceLabel: 'Netflix',
        senderDomain: 'vitamins.com',
        senderEmail: 'promo@vitamins.com',
      });
      expect(result.isLeak).toBe(true);
    });

    it('email from netflix.com to Netflix-labeled alias → no leak', () => {
      const result = checkForLeak({
        serviceLabel: 'Netflix',
        senderDomain: 'netflix.com',
        senderEmail: 'info@netflix.com',
      });
      expect(result.isLeak).toBe(false);
    });

    it('email from email.netflix.com to Netflix-labeled alias → no leak', () => {
      const result = checkForLeak({
        serviceLabel: 'Netflix',
        senderDomain: 'email.netflix.com',
        senderEmail: 'noreply@email.netflix.com',
      });
      expect(result.isLeak).toBe(false);
    });

    it('does NOT flag infrastructure senders (sendgrid.net)', () => {
      const result = checkForLeak({
        serviceLabel: 'Netflix',
        senderDomain: 'sendgrid.net',
        senderEmail: 'bounce@sendgrid.net',
      });
      expect(result.isLeak).toBe(false);
    });

    it('does NOT flag infrastructure senders (amazonaws.com)', () => {
      const result = checkForLeak({
        serviceLabel: 'Uber',
        senderDomain: 'email-smtp.amazonaws.com',
        senderEmail: 'noreply@email-smtp.amazonaws.com',
      });
      expect(result.isLeak).toBe(false);
    });

    it('does NOT flag infrastructure senders (mailgun.org)', () => {
      const result = checkForLeak({
        serviceLabel: 'Spotify',
        senderDomain: 'mg.mailgun.org',
        senderEmail: 'noreply@mg.mailgun.org',
      });
      expect(result.isLeak).toBe(false);
    });

    it('no service label → no leak check', () => {
      const result = checkForLeak({
        serviceLabel: '',
        senderDomain: 'spam.com',
        senderEmail: 'spam@spam.com',
      });
      expect(result.isLeak).toBe(false);
    });
  });

  describe('matchesSenderDomain', () => {
    it('case insensitive matching', () => {
      expect(matchesSenderDomain('Netflix', 'NETFLIX.COM')).toBe(true);
    });

    it('subdomain matching', () => {
      expect(matchesSenderDomain('uber', 'mail.uber.com')).toBe(true);
    });

    it('partial match in domain', () => {
      expect(matchesSenderDomain('netflix', 'netflixmail.com')).toBe(true);
    });

    it('no match for completely different domain', () => {
      expect(matchesSenderDomain('Netflix', 'spam-factory.com')).toBe(false);
    });
  });

  describe('isInfrastructureDomain', () => {
    it('identifies sendgrid.net', () => {
      expect(isInfrastructureDomain('sendgrid.net')).toBe(true);
    });

    it('identifies subdomains of infrastructure', () => {
      expect(isInfrastructureDomain('em1234.sendgrid.net')).toBe(true);
    });

    it('does not flag regular domains', () => {
      expect(isInfrastructureDomain('netflix.com')).toBe(false);
    });
  });

  describe('GET /api/v2/leaks', () => {
    it('returns user non-dismissed detections sorted by date desc', async () => {
      mockLeaks = [
        {
          id: 'leak-1',
          expected_sender: 'Netflix',
          actual_sender_domain: 'spam.com',
          dismissed: false,
          detected_at: '2026-03-01T00:00:00Z',
        },
      ];

      const req = new Request('http://localhost/api/v2/leaks', {
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.leaks).toHaveLength(1);
      expect(data.leaks[0].actual_sender_domain).toBe('spam.com');
    });
  });

  describe('PATCH /api/v2/leaks/:id/dismiss', () => {
    it('dismiss endpoint sets dismissed=true', async () => {
      const req = new Request('http://localhost/api/v2/leaks/leak-1/dismiss', {
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = await PATCH(req, { params: { id: 'leak-1' } });
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({ dismissed: true });
    });
  });
});
