import { encrypt, decrypt } from './index';

/**
 * Server-side encryption-at-rest for forwarding email addresses.
 *
 * The email-forwarding product inherently requires the server to read the real
 * address (to deliver mail), so this is NOT zero-knowledge — it is defense in
 * depth: a database breach won't expose forwarding addresses in plaintext.
 * Keyed by FORWARDING_ENCRYPTION_KEY (64 hex chars = 32 bytes).
 *
 * When the key is absent (e.g. local dev without config), both functions act as
 * pass-throughs so the app keeps working — but addresses are then stored
 * plaintext, so the key MUST be set in production for the guarantee to hold.
 */

let cachedKey: Buffer | null | undefined;

function getServerKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const hex = process.env.FORWARDING_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
    cachedKey = null;
    return null;
  }
  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

/** True if a value looks like our hex ciphertext rather than a plaintext email. */
function looksEncrypted(value: string): boolean {
  // Ciphertext is hex and at least iv(12)+tag(16) = 28 bytes = 56 hex chars.
  // Plaintext emails contain '@' and other non-hex characters.
  return value.length >= 56 && /^[0-9a-f]+$/i.test(value);
}

/** Encrypt a forwarding email for storage. Returns plaintext unchanged if no key configured. */
export function encryptForwardingEmailAtRest(email: string): string {
  const key = getServerKey();
  if (!key) return email;
  return encrypt(email, key);
}

/**
 * Decrypt a stored forwarding email for use/display. Tolerant of legacy plaintext
 * rows (written before encryption was enabled) — returns them unchanged.
 */
export function decryptForwardingEmailAtRest(stored: string | null): string | null {
  if (!stored) return stored;
  const key = getServerKey();
  if (!key || !looksEncrypted(stored)) return stored;
  try {
    return decrypt(stored, key);
  } catch {
    // Not decryptable with the current key (legacy / different key) — return as-is.
    return stored;
  }
}

/** Whether at-rest encryption is active (key configured). */
export function forwardingEncryptionEnabled(): boolean {
  return getServerKey() !== null;
}
