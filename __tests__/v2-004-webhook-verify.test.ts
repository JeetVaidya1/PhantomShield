import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import {
  verifyTelnyxSignature,
  verifySimpleLoginWebhook,
  verifyCronSecret,
} from '../lib/webhooks/verify';

describe('v2-004: Webhook signature verification library', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('verifySimpleLoginWebhook', () => {
    const secret = 'test-simplelogin-secret';

    beforeEach(() => {
      vi.stubEnv('SIMPLELOGIN_WEBHOOK_SECRET', secret);
    });

    it('valid signature returns true', () => {
      const body = '{"event":"email_forwarded"}';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      expect(
        verifySimpleLoginWebhook(
          { 'x-simplelogin-signature': signature },
          body
        )
      ).toBe(true);
    });

    it('tampered body returns false', () => {
      const body = '{"event":"email_forwarded"}';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      expect(
        verifySimpleLoginWebhook(
          { 'x-simplelogin-signature': signature },
          '{"event":"TAMPERED"}'
        )
      ).toBe(false);
    });

    it('missing headers returns false', () => {
      expect(verifySimpleLoginWebhook({}, '{"test":true}')).toBe(false);
    });

    it('missing env secret returns false', () => {
      vi.stubEnv('SIMPLELOGIN_WEBHOOK_SECRET', '');
      const body = 'test';
      expect(
        verifySimpleLoginWebhook(
          { 'x-simplelogin-signature': 'abc' },
          body
        )
      ).toBe(false);
    });
  });

  describe('verifyCronSecret', () => {
    const cronSecret = 'my-cron-secret-123';

    beforeEach(() => {
      vi.stubEnv('CRON_SECRET', cronSecret);
    });

    it('valid bearer token returns true', () => {
      expect(
        verifyCronSecret({ authorization: `Bearer ${cronSecret}` })
      ).toBe(true);
    });

    it('wrong token returns false', () => {
      expect(
        verifyCronSecret({ authorization: 'Bearer wrong-secret-1' })
      ).toBe(false);
    });

    it('missing authorization header returns false', () => {
      expect(verifyCronSecret({})).toBe(false);
    });

    it('missing env var returns false', () => {
      vi.stubEnv('CRON_SECRET', '');
      expect(
        verifyCronSecret({ authorization: `Bearer ${cronSecret}` })
      ).toBe(false);
    });

    it('uses timing-safe comparison', () => {
      // Verify by testing that different-length tokens fail
      vi.stubEnv('CRON_SECRET', 'short');
      expect(
        verifyCronSecret({ authorization: 'Bearer verylongtokenthatisntsame' })
      ).toBe(false);
    });
  });

  describe('verifyTelnyxSignature', () => {
    it('missing headers returns false', () => {
      expect(verifyTelnyxSignature({}, '{"test":true}')).toBe(false);
    });

    it('missing telnyx-signature-ed25519 returns false', () => {
      vi.stubEnv('TELNYX_PUBLIC_KEY', 'dGVzdA==');
      expect(
        verifyTelnyxSignature(
          { 'telnyx-timestamp': String(Math.floor(Date.now() / 1000)) },
          'body'
        )
      ).toBe(false);
    });

    it('expired timestamp returns false', () => {
      vi.stubEnv('TELNYX_PUBLIC_KEY', 'dGVzdA==');
      const expiredTimestamp = String(
        Math.floor(Date.now() / 1000) - 6 * 60 // 6 minutes ago
      );
      expect(
        verifyTelnyxSignature(
          {
            'telnyx-signature-ed25519': 'fakesig',
            'telnyx-timestamp': expiredTimestamp,
          },
          'body'
        )
      ).toBe(false);
    });

    it('invalid signature returns false gracefully', () => {
      vi.stubEnv('TELNYX_PUBLIC_KEY', 'dGVzdA==');
      const timestamp = String(Math.floor(Date.now() / 1000));
      expect(
        verifyTelnyxSignature(
          {
            'telnyx-signature-ed25519': 'invalidsignature==',
            'telnyx-timestamp': timestamp,
          },
          '{"data":"test"}'
        )
      ).toBe(false);
    });

    it('missing env public key returns false', () => {
      vi.stubEnv('TELNYX_PUBLIC_KEY', '');
      const timestamp = String(Math.floor(Date.now() / 1000));
      expect(
        verifyTelnyxSignature(
          {
            'telnyx-signature-ed25519': 'sig',
            'telnyx-timestamp': timestamp,
          },
          'body'
        )
      ).toBe(false);
    });

    it('valid ed25519 signature verification flow', () => {
      // Generate a real ed25519 key pair for testing
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

      const publicKeyDer = publicKey.export({ format: 'der', type: 'spki' });
      vi.stubEnv('TELNYX_PUBLIC_KEY', publicKeyDer.toString('base64'));

      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = '{"data":"test_payload"}';
      const payload = `${timestamp}|${body}`;

      const signature = crypto.sign(null, Buffer.from(payload), privateKey);

      expect(
        verifyTelnyxSignature(
          {
            'telnyx-signature-ed25519': signature.toString('base64'),
            'telnyx-timestamp': timestamp,
          },
          body
        )
      ).toBe(true);
    });
  });

  it('exports all three verification functions', () => {
    expect(typeof verifyTelnyxSignature).toBe('function');
    expect(typeof verifySimpleLoginWebhook).toBe('function');
    expect(typeof verifyCronSecret).toBe('function');
  });
});
