import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getPhoneProvider } from '../lib/phone/factory';
import { TwilioProvider } from '../lib/phone/providers/twilio';
import type { PhoneProvider } from '../lib/phone/provider';

describe('v2-006: Phone provider interface and factory', () => {
  const ORIGINAL = process.env.PHONE_PROVIDER;

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.PHONE_PROVIDER;
    } else {
      process.env.PHONE_PROVIDER = ORIGINAL;
    }
    vi.unstubAllEnvs();
  });

  describe('factory', () => {
    it('returns TwilioProvider when PHONE_PROVIDER=twilio', () => {
      vi.stubEnv('PHONE_PROVIDER', 'twilio');
      const provider = getPhoneProvider();
      expect(provider).toBeInstanceOf(TwilioProvider);
      expect(provider.name).toBe('twilio');
    });

    it('throws a descriptive error for an unknown provider value', () => {
      vi.stubEnv('PHONE_PROVIDER', 'telnyx');
      expect(() => getPhoneProvider()).toThrowError(/Unknown PHONE_PROVIDER/);
    });

    it('throws when PHONE_PROVIDER is not set', () => {
      vi.stubEnv('PHONE_PROVIDER', '');
      expect(() => getPhoneProvider()).toThrowError(/not set/);
    });
  });

  describe('interface shape', () => {
    it('exposes buyNumber, releaseNumber, verifyWebhook, parseInboundSMS', () => {
      const provider: PhoneProvider = new TwilioProvider();
      expect(typeof provider.buyNumber).toBe('function');
      expect(typeof provider.releaseNumber).toBe('function');
      expect(typeof provider.verifyWebhook).toBe('function');
      expect(typeof provider.parseInboundSMS).toBe('function');
    });

    it('is receive-only: has NO sendSMS method (per CLAUDE.md V2)', () => {
      const provider = new TwilioProvider() as unknown as Record<string, unknown>;
      expect(provider.sendSMS).toBeUndefined();
    });

    it('parseInboundSMS normalizes a Twilio form payload', () => {
      const provider = new TwilioProvider();
      const parsed = provider.parseInboundSMS({
        From: '+15551112222',
        To: '+15553334444',
        Body: 'Your code is 123456',
        MessageSid: 'SM123',
      });
      expect(parsed).toEqual({
        from: '+15551112222',
        to: '+15553334444',
        text: 'Your code is 123456',
        messageId: 'SM123',
      });
    });
  });
});
