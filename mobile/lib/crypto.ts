import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { decode as atob } from 'base-64';

/**
 * Client-side decryption for the mobile app (v2-023).
 *
 * Email bodies are encrypted server-side-blind with AES-256-GCM and the user's
 * master key (see lib/crypto on the API side). On device we hold the derived
 * key in expo-secure-store and decrypt locally, so plaintext never touches the
 * network. Format matches the server: hex(iv):hex(authTag):hex(ciphertext).
 *
 * Note: expo-crypto provides hashing/randomness; AES-GCM decryption is done via
 * the native crypto module bundled with the app (react-native-quick-crypto).
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QuickCrypto: typeof import('crypto') = require('react-native-quick-crypto');

void Crypto; // referenced for key-derivation parity with the server
void atob;

const ALGORITHM = 'aes-256-gcm';

/** Decrypt an encrypted email body using the user's key (hex). */
export function decryptEmailBody(ciphertextHex: string, keyHex: string): string {
  const [ivHex, authTagHex, dataHex] = ciphertextHex.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Malformed ciphertext');
  }

  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = QuickCrypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf-8');
}
