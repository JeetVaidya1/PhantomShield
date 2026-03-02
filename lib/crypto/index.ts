import { randomBytes, pbkdf2, createCipheriv, createDecipheriv } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

// Constants
const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 recommendation for SHA-256
const KEY_LENGTH = 32; // 256 bits for AES-256
const SALT_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_CHECK_PLAINTEXT = 'phantom-key-check-v1';

/**
 * Generate a random salt for key derivation.
 */
export function generateSalt(): string {
  return randomBytes(SALT_LENGTH).toString('hex');
}

/**
 * Derive a 256-bit encryption key from a master password and salt using PBKDF2.
 * This runs client-side — the derived key never leaves the client.
 */
export async function deriveKey(password: string, saltHex: string): Promise<Buffer> {
  const salt = Buffer.from(saltHex, 'hex');
  return pbkdf2Async(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns hex-encoded ciphertext (iv + authTag + encrypted data).
 */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv (12 bytes) + authTag (16 bytes) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * Input is hex-encoded (iv + authTag + encrypted data).
 */
export function decrypt(ciphertextHex: string, key: Buffer): string {
  const data = Buffer.from(ciphertextHex, 'hex');

  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid ciphertext: too short');
  }

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Create a key check value — encrypts a known string so we can verify
 * the correct master password was provided during login.
 */
export function createKeyCheck(key: Buffer): string {
  return encrypt(KEY_CHECK_PLAINTEXT, key);
}

/**
 * Verify a key check value — attempts to decrypt and compare against known plaintext.
 * Returns true if the key is correct.
 */
export function verifyKeyCheck(key: Buffer, keyCheckHex: string): boolean {
  try {
    const decrypted = decrypt(keyCheckHex, key);
    return decrypted === KEY_CHECK_PLAINTEXT;
  } catch {
    return false;
  }
}

/**
 * Encrypt a forwarding email address with the user's derived key.
 */
export function encryptForwardingEmail(email: string, key: Buffer): string {
  return encrypt(email, key);
}

/**
 * Decrypt a forwarding email address with the user's derived key.
 */
export function decryptForwardingEmail(encryptedEmail: string, key: Buffer): string {
  return decrypt(encryptedEmail, key);
}
