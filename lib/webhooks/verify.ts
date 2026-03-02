import crypto from 'crypto';

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify Telnyx webhook signature using ed25519.
 * Uses telnyx-signature-ed25519 and telnyx-timestamp headers.
 * Rejects requests older than 5 minutes (replay protection).
 */
export function verifyTelnyxSignature(
  headers: Record<string, string>,
  body: string
): boolean {
  try {
    const signature = headers['telnyx-signature-ed25519'];
    const timestamp = headers['telnyx-timestamp'];
    const publicKey = process.env.TELNYX_PUBLIC_KEY;

    if (!signature || !timestamp || !publicKey) {
      return false;
    }

    // Replay protection: reject requests older than 5 minutes
    const timestampMs = parseInt(timestamp, 10) * 1000;
    if (isNaN(timestampMs) || Date.now() - timestampMs > REPLAY_WINDOW_MS) {
      return false;
    }

    const payload = `${timestamp}|${body}`;
    const signatureBuffer = Buffer.from(signature, 'base64');
    const publicKeyBuffer = Buffer.from(publicKey, 'base64');

    return crypto.verify(
      null,
      Buffer.from(payload),
      {
        key: publicKeyBuffer,
        format: 'der',
        type: 'spki',
      },
      signatureBuffer
    );
  } catch {
    return false;
  }
}

/**
 * Verify SimpleLogin webhook using HMAC-SHA256.
 */
export function verifySimpleLoginWebhook(
  headers: Record<string, string>,
  body: string
): boolean {
  try {
    const signature = headers['x-simplelogin-signature'];
    const secret = process.env.SIMPLELOGIN_WEBHOOK_SECRET;

    if (!signature || !secret) {
      return false;
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

/**
 * Verify cron secret from Authorization: Bearer header.
 * Uses timing-safe comparison.
 */
export function verifyCronSecret(
  headers: Record<string, string>
): boolean {
  try {
    const authHeader = headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;

    if (!authHeader || !cronSecret) {
      return false;
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token.length !== cronSecret.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(cronSecret)
    );
  } catch {
    return false;
  }
}
