import { describe, it, expect } from 'vitest';
import {
  generateSalt,
  deriveKey,
  encrypt,
  decrypt,
  createKeyCheck,
  verifyKeyCheck,
  encryptForwardingEmail,
  decryptForwardingEmail,
} from '../lib/crypto/index';

describe('Crypto utilities', () => {
  describe('generateSalt', () => {
    it('returns a 64-character hex string (32 bytes)', () => {
      const salt = generateSalt();
      expect(salt).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates unique salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('deriveKey', () => {
    it('derives a 32-byte key from password and salt', async () => {
      const salt = generateSalt();
      const key = await deriveKey('test-password', salt);
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('same password + salt produces same key', async () => {
      const salt = generateSalt();
      const key1 = await deriveKey('my-password', salt);
      const key2 = await deriveKey('my-password', salt);
      expect(key1.equals(key2)).toBe(true);
    });

    it('different passwords produce different keys', async () => {
      const salt = generateSalt();
      const key1 = await deriveKey('password-a', salt);
      const key2 = await deriveKey('password-b', salt);
      expect(key1.equals(key2)).toBe(false);
    });

    it('different salts produce different keys', async () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      const key1 = await deriveKey('same-password', salt1);
      const key2 = await deriveKey('same-password', salt2);
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('encrypt / decrypt', () => {
    it('round-trips plaintext correctly', async () => {
      const salt = generateSalt();
      const key = await deriveKey('test-password', salt);
      const plaintext = 'Hello, World!';

      const ciphertext = encrypt(plaintext, key);
      const decrypted = decrypt(ciphertext, key);

      expect(decrypted).toBe(plaintext);
    });

    it('produces hex-encoded ciphertext', async () => {
      const salt = generateSalt();
      const key = await deriveKey('test-password', salt);
      const ciphertext = encrypt('test', key);
      expect(ciphertext).toMatch(/^[0-9a-f]+$/);
    });

    it('same plaintext produces different ciphertext (random IV)', async () => {
      const salt = generateSalt();
      const key = await deriveKey('test-password', salt);
      const ct1 = encrypt('same text', key);
      const ct2 = encrypt('same text', key);
      expect(ct1).not.toBe(ct2);
    });

    it('wrong key fails to decrypt', async () => {
      const salt = generateSalt();
      const key1 = await deriveKey('password-a', salt);
      const key2 = await deriveKey('password-b', salt);

      const ciphertext = encrypt('secret data', key1);
      expect(() => decrypt(ciphertext, key2)).toThrow();
    });

    it('tampered ciphertext fails to decrypt', async () => {
      const salt = generateSalt();
      const key = await deriveKey('test-password', salt);
      const ciphertext = encrypt('test', key);

      // Flip a byte in the encrypted data
      const tampered =
        ciphertext.slice(0, -4) +
        (ciphertext.slice(-4) === '0000' ? 'ffff' : '0000');

      expect(() => decrypt(tampered, key)).toThrow();
    });

    it('rejects too-short ciphertext', async () => {
      const salt = generateSalt();
      const key = await deriveKey('test-password', salt);
      expect(() => decrypt('aabb', key)).toThrow('too short');
    });

    it('handles empty string', async () => {
      const salt = generateSalt();
      const key = await deriveKey('test-password', salt);
      const ct = encrypt('', key);
      expect(decrypt(ct, key)).toBe('');
    });

    it('handles unicode text', async () => {
      const salt = generateSalt();
      const key = await deriveKey('test-password', salt);
      const text = 'user@example.com';
      const ct = encrypt(text, key);
      expect(decrypt(ct, key)).toBe(text);
    });
  });

  describe('key check', () => {
    it('createKeyCheck returns a hex string', async () => {
      const salt = generateSalt();
      const key = await deriveKey('test-password', salt);
      const check = createKeyCheck(key);
      expect(check).toMatch(/^[0-9a-f]+$/);
    });

    it('verifyKeyCheck returns true for correct key', async () => {
      const salt = generateSalt();
      const key = await deriveKey('test-password', salt);
      const check = createKeyCheck(key);
      expect(verifyKeyCheck(key, check)).toBe(true);
    });

    it('verifyKeyCheck returns false for wrong key', async () => {
      const salt = generateSalt();
      const key1 = await deriveKey('password-a', salt);
      const key2 = await deriveKey('password-b', salt);
      const check = createKeyCheck(key1);
      expect(verifyKeyCheck(key2, check)).toBe(false);
    });

    it('verifyKeyCheck returns false for garbage input', async () => {
      const salt = generateSalt();
      const key = await deriveKey('test-password', salt);
      expect(verifyKeyCheck(key, 'not-valid-hex')).toBe(false);
    });
  });

  describe('forwarding email encryption', () => {
    it('encrypts and decrypts forwarding email', async () => {
      const salt = generateSalt();
      const key = await deriveKey('master-password', salt);
      const email = 'user@gmail.com';

      const encrypted = encryptForwardingEmail(email, key);
      expect(encrypted).not.toBe(email);
      expect(encrypted).toMatch(/^[0-9a-f]+$/);

      const decrypted = decryptForwardingEmail(encrypted, key);
      expect(decrypted).toBe(email);
    });
  });
});
