import { describe, it, expect } from 'vitest';
import {
  aliasLabelSchema,
  companyNameSchema,
  phoneNumberSchema,
  gdprRequestSchema,
  honeypotCreateSchema,
  digestSettingsSchema,
  domainReportSchema,
  stripHtml,
} from '../lib/validations/v2-schemas';

describe('v2-005: Zod validation schemas', () => {
  describe('aliasLabelSchema', () => {
    it('XSS attempt stripped: <script>alert(1)</script>Netflix → Netflix', () => {
      const result = aliasLabelSchema.safeParse(
        '<script>alert(1)</script>Netflix'
      );
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('Netflix');
    });

    it('rejects empty string after strip', () => {
      const result = aliasLabelSchema.safeParse('<script></script>');
      expect(result.success).toBe(false);
    });

    it('rejects labels over 100 chars', () => {
      const result = aliasLabelSchema.safeParse('A'.repeat(101));
      expect(result.success).toBe(false);
    });

    it('accepts valid alphanumeric labels', () => {
      const result = aliasLabelSchema.safeParse('My Netflix Account');
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('My Netflix Account');
    });

    it('strips HTML tags from input', () => {
      const result = aliasLabelSchema.safeParse('<b>Bold</b> Label');
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('Bold Label');
    });
  });

  describe('companyNameSchema', () => {
    it('SQL injection attempt returns sanitized string', () => {
      const result = companyNameSchema.safeParse(
        "'; DROP TABLE users; --"
      );
      // After strip HTML (no HTML in this case), it should pass as-is
      // The schema doesn't block SQL — that's Supabase's job via parameterized queries
      // But it does strip HTML
      expect(result.success).toBe(true);
    });

    it('strips HTML from company name', () => {
      const result = companyNameSchema.safeParse(
        '<img src=x onerror=alert(1)>Evil Corp'
      );
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('Evil Corp');
    });

    it('rejects over 200 chars', () => {
      const result = companyNameSchema.safeParse('A'.repeat(201));
      expect(result.success).toBe(false);
    });
  });

  describe('phoneNumberSchema', () => {
    it("invalid phone number '+abc' fails validation", () => {
      const result = phoneNumberSchema.safeParse('+abc');
      expect(result.success).toBe(false);
    });

    it('rejects phone without + prefix', () => {
      const result = phoneNumberSchema.safeParse('15551234567');
      expect(result.success).toBe(false);
    });

    it('rejects +0 prefix', () => {
      const result = phoneNumberSchema.safeParse('+0551234567');
      expect(result.success).toBe(false);
    });

    it('accepts valid E.164 number', () => {
      const result = phoneNumberSchema.safeParse('+15551234567');
      expect(result.success).toBe(true);
    });

    it('accepts international number', () => {
      const result = phoneNumberSchema.safeParse('+447911123456');
      expect(result.success).toBe(true);
    });
  });

  describe('gdprRequestSchema', () => {
    it('validates company_email format', () => {
      const result = gdprRequestSchema.safeParse({
        company_name: 'Netflix',
        company_email: 'not-an-email',
        identity_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid GDPR request', () => {
      const result = gdprRequestSchema.safeParse({
        company_name: 'Netflix',
        company_email: 'privacy@netflix.com',
        identity_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('honeypotCreateSchema', () => {
    it('validates planted_at_url as URL format', () => {
      const result = honeypotCreateSchema.safeParse({
        label: 'Trap for Scammers',
        planted_at_service: 'Dark Web Forum',
        planted_at_url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid honeypot without URL (optional)', () => {
      const result = honeypotCreateSchema.safeParse({
        label: 'Trap alias',
        planted_at_service: 'Sketchy Site',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid honeypot with URL', () => {
      const result = honeypotCreateSchema.safeParse({
        label: 'Trap alias',
        planted_at_service: 'Forum XYZ',
        planted_at_url: 'https://example.com/signup',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('digestSettingsSchema', () => {
    it('validates time format HH:MM', () => {
      const result = digestSettingsSchema.safeParse({
        email_forward_mode: 'digest',
        digest_frequency: 'daily',
        digest_time: '25:00',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid digest settings', () => {
      const result = digestSettingsSchema.safeParse({
        email_forward_mode: 'summary',
        digest_frequency: 'weekly',
        digest_time: '08:00',
        digest_day: 1,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid enum value', () => {
      const result = digestSettingsSchema.safeParse({
        email_forward_mode: 'invalid',
        digest_frequency: 'daily',
        digest_time: '08:00',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('domainReportSchema', () => {
    it('validates domain_id as UUID', () => {
      const result = domainReportSchema.safeParse({
        domain_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid UUID', () => {
      const result = domainReportSchema.safeParse({
        domain_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('stripHtml utility', () => {
    it('removes all HTML tags', () => {
      expect(stripHtml('<div><p>Hello</p></div>')).toBe('Hello');
    });

    it('handles nested tags', () => {
      expect(stripHtml('<b><i>Bold Italic</i></b>')).toBe('Bold Italic');
    });

    it('trims whitespace', () => {
      expect(stripHtml('  hello  ')).toBe('hello');
    });
  });

  it('valid inputs pass all schemas', () => {
    expect(aliasLabelSchema.safeParse('My Account').success).toBe(true);
    expect(companyNameSchema.safeParse('Acme Inc').success).toBe(true);
    expect(phoneNumberSchema.safeParse('+15551234567').success).toBe(true);
    expect(
      gdprRequestSchema.safeParse({
        company_name: 'Test Co',
        company_email: 'privacy@test.com',
        identity_id: '550e8400-e29b-41d4-a716-446655440000',
      }).success
    ).toBe(true);
  });
});
