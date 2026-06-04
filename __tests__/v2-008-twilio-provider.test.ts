import { describe, it, expect, afterEach, vi } from 'vitest';
import { getPhoneProvider } from '../lib/phone/factory';
import { TwilioProvider } from '../lib/phone/providers/twilio';
// Backwards-compat path must still resolve the provider.
import { TwilioProvider as TwilioFromLegacyPath } from '../lib/twilio';

describe('v2-008: Twilio provider refactor', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('old lib/twilio.ts re-exports TwilioProvider from the new location', () => {
    expect(TwilioFromLegacyPath).toBe(TwilioProvider);
  });

  it('factory returns a TwilioProvider when PHONE_PROVIDER=twilio', () => {
    vi.stubEnv('PHONE_PROVIDER', 'twilio');
    expect(getPhoneProvider()).toBeInstanceOf(TwilioProvider);
  });

  it('TwilioProvider implements the receive-only PhoneProvider contract', () => {
    const p = new TwilioProvider();
    expect(p.name).toBe('twilio');
    for (const method of ['buyNumber', 'releaseNumber', 'verifyWebhook', 'parseInboundSMS']) {
      expect(typeof (p as unknown as Record<string, unknown>)[method]).toBe('function');
    }
  });

  it('parseInboundSMS extracts an OTP-bearing inbound message', () => {
    const p = new TwilioProvider();
    const parsed = p.parseInboundSMS({
      From: '+15550000001',
      To: '+15550000002',
      Body: 'PhantomDefender code: 4821',
      MessageSid: 'SMabc',
    });
    expect(parsed.from).toBe('+15550000001');
    expect(parsed.text).toContain('4821');
  });
});
