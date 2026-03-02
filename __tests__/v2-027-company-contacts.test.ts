import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockInsertAudit = vi.fn().mockResolvedValue({ error: null });
const mockInsertDeletion = vi.fn();

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
      if (table === 'company_privacy_contacts') {
        return {
          select: () => ({
            eq: (_field: string, value: string) => ({
              single: () => {
                if (value === 'google.com') {
                  return Promise.resolve({
                    data: {
                      id: 'cc-1',
                      company_domain: 'google.com',
                      company_name: 'Google',
                      privacy_email: 'privacy@google.com',
                      dpo_email: 'data-protection-office@google.com',
                      privacy_page_url: 'https://policies.google.com/privacy',
                      verified: true,
                      contributed_by_count: 0,
                    },
                    error: null,
                  });
                }
                return Promise.resolve({ data: null, error: { message: 'not found' } });
              },
            }),
          }),
          upsert: mockUpsert,
        };
      }
      if (table === 'identities') {
        return {
          select: () => ({
            eq: (_f: string, _v: string) => ({
              eq: (_f2: string, _v2: string) => ({
                single: () =>
                  Promise.resolve({
                    data: { id: 'id-1', alias_email: 'alias@phantomdefender.com', user_id: 'user-123' },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === 'deletion_requests') {
        return {
          insert: mockInsertDeletion.mockReturnValue({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'dr-1',
                    status: 'sent',
                    sent_at: '2026-03-01T00:00:00.000Z',
                    response_deadline: '2026-03-31T00:00:00.000Z',
                  },
                  error: null,
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

import { GET } from '../app/api/v2/company-contacts/[domain]/route';
import { POST } from '../app/api/v2/deletion-requests/route';

describe('v2-027: Company privacy contacts DB + API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v2/company-contacts/:domain', () => {
    it('returns contact for known company', async () => {
      const req = new Request('http://localhost/api/v2/company-contacts/google.com', {
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = await GET(req, { params: { domain: 'google.com' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.contact.company_name).toBe('Google');
      expect(data.contact.privacy_email).toBe('privacy@google.com');
      expect(data.contact.dpo_email).toBe('data-protection-office@google.com');
    });

    it('returns 404 for unknown company', async () => {
      const req = new Request('http://localhost/api/v2/company-contacts/unknown-company.xyz', {
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = await GET(req, { params: { domain: 'unknown-company.xyz' } });
      expect(res.status).toBe(404);
    });

    it('normalizes domain input (lowercase, trim)', async () => {
      const req = new Request('http://localhost/api/v2/company-contacts/Google.COM', {
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = await GET(req, { params: { domain: 'Google.COM' } });
      // Should normalize to google.com and find the contact
      expect(res.status).toBe(200);
    });

    it('rejects invalid domain format', async () => {
      const req = new Request('http://localhost/api/v2/company-contacts/not-a-domain', {
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = await GET(req, { params: { domain: 'not-a-domain' } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid domain');
    });

    it('rejects unauthenticated request', async () => {
      const req = new Request('http://localhost/api/v2/company-contacts/google.com', {
        headers: {},
      });
      const res = await GET(req, { params: { domain: 'google.com' } });
      expect(res.status).toBe(401);
    });
  });

  describe('Crowdsourcing via GDPR requests', () => {
    it('saves unknown company contact when creating GDPR request', async () => {
      const req = new Request('http://localhost/api/v2/deletion-requests', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          company_name: 'New Corp',
          company_email: 'dpo@newcorp.com',
          identity_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });
      await POST(req);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          company_domain: 'newcorp.com',
          company_name: 'New Corp',
          privacy_email: 'dpo@newcorp.com',
          contributed_by_count: 1,
        }),
        { onConflict: 'company_domain' }
      );
    });
  });

  describe('Seed data', () => {
    it('seed file contains 200+ company contacts', async () => {
      const seed = await import('../data/company-contacts-seed.json');
      const contacts = Array.isArray(seed.default) ? seed.default : seed;
      expect(contacts.length).toBeGreaterThanOrEqual(200);
    });

    it('seed contacts have required fields', async () => {
      const seed = await import('../data/company-contacts-seed.json');
      const contacts = Array.isArray(seed.default) ? seed.default : seed;
      for (const contact of contacts.slice(0, 10)) {
        expect(contact.company_domain).toBeTruthy();
        expect(contact.company_name).toBeTruthy();
        expect(contact.privacy_email).toBeTruthy();
        expect(typeof contact.verified).toBe('boolean');
      }
    });

    it('seed includes major companies: Google, Apple, Amazon, Meta, Netflix, Uber', async () => {
      const seed = await import('../data/company-contacts-seed.json');
      const contacts = Array.isArray(seed.default) ? seed.default : seed;
      const domains = contacts.map((c: any) => c.company_domain);
      expect(domains).toContain('google.com');
      expect(domains).toContain('apple.com');
      expect(domains).toContain('amazon.com');
      expect(domains).toContain('meta.com');
      expect(domains).toContain('netflix.com');
      expect(domains).toContain('uber.com');
    });
  });
});
