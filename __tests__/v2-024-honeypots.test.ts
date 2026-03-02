import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockIdentities: any[] = [];
let mockTriggers: any[] = [];
const mockInsertIdentity = vi.fn();
const mockInsertTrigger = vi.fn();
const mockInsertAudit = vi.fn().mockResolvedValue({ error: null });

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
          insert: mockInsertIdentity.mockReturnValue({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: 'hp-1', is_honeypot: true, label: 'Test Trap' },
                  error: null,
                }),
            }),
          }),
          select: () => ({
            eq: (_f: string, _v: any) => ({
              eq: (_f2: string, _v2: any) => ({
                order: () =>
                  Promise.resolve({ data: mockIdentities, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'honeypot_triggers') {
        return {
          insert: mockInsertTrigger.mockResolvedValue({ error: null }),
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({ data: mockTriggers, error: null }),
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

import { POST, GET } from '../app/api/v2/honeypots/route';
import { handleHoneypotEmail } from '../lib/email/honeypot-handler';

describe('v2-024: Honeypot alias creation and trigger detection', () => {
  beforeEach(() => {
    mockIdentities = [];
    mockTriggers = [];
    vi.clearAllMocks();
  });

  describe('POST /api/v2/honeypots', () => {
    it('creates identity with is_honeypot=true', async () => {
      const req = new Request('http://localhost/api/v2/honeypots', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          label: 'Test Trap',
          planted_at_service: 'Sketchy Forum',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(mockInsertIdentity).toHaveBeenCalledWith(
        expect.objectContaining({
          is_honeypot: true,
          service_label: 'Sketchy Forum',
        })
      );
    });

    it('input validated: label required', async () => {
      const req = new Request('http://localhost/api/v2/honeypots', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          label: '',
          planted_at_service: 'Forum',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('logged to audit_log', async () => {
      const req = new Request('http://localhost/api/v2/honeypots', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          label: 'Trap',
          planted_at_service: 'Dark Forum',
        }),
      });
      await POST(req);
      expect(mockInsertAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'honeypot_created',
        })
      );
    });
  });

  describe('GET /api/v2/honeypots', () => {
    it('returns honeypots with trigger_count and last_trigger', async () => {
      mockIdentities = [
        { id: 'hp-1', is_honeypot: true, service_label: 'Forum', created_at: '2026-01-01' },
      ];
      mockTriggers = [
        { triggered_at: '2026-02-15', trigger_from_email: 'spam@evil.com' },
      ];

      const req = new Request('http://localhost/api/v2/honeypots', {
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.honeypots[0].trigger_count).toBe(1);
      expect(data.honeypots[0].last_trigger).toBe('2026-02-15');
    });
  });

  describe('handleHoneypotEmail', () => {
    it('email to honeypot → not forwarded, trigger recorded', async () => {
      const result = await handleHoneypotEmail({
        identityId: 'hp-1',
        userId: 'user-123',
        isHoneypot: true,
        senderEmail: 'spam@evil.com',
        senderDomain: 'evil.com',
        subject: 'Buy now!',
      });

      expect(result.isHoneypot).toBe(true);
      expect(result.shouldForward).toBe(false);
      expect(mockInsertTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          identity_id: 'hp-1',
          trigger_from_email: 'spam@evil.com',
          trigger_from_domain: 'evil.com',
        })
      );
    });

    it('email to non-honeypot → forwarded normally', async () => {
      const result = await handleHoneypotEmail({
        identityId: 'id-1',
        userId: 'user-123',
        isHoneypot: false,
        senderEmail: 'legit@company.com',
        senderDomain: 'company.com',
        subject: 'Welcome',
      });

      expect(result.isHoneypot).toBe(false);
      expect(result.shouldForward).toBe(true);
      expect(mockInsertTrigger).not.toHaveBeenCalled();
    });

    it('honeypot trigger logged to audit_log', async () => {
      await handleHoneypotEmail({
        identityId: 'hp-1',
        userId: 'user-123',
        isHoneypot: true,
        senderEmail: 'spam@evil.com',
        senderDomain: 'evil.com',
        subject: 'Scam',
      });

      expect(mockInsertAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'honeypot_triggered',
        })
      );
    });
  });
});
