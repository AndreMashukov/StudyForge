import { createDecipheriv, createHash } from 'crypto';
import type { IEncryptedSecretRecord } from '@shared-types';

const ENCRYPTION_KEY_ENV = 'LLM_SETTINGS_ENCRYPTION_KEY';
const ALGORITHM = 'aes-256-gcm';

function deriveKey(): Buffer {
  const raw = process.env[ENCRYPTION_KEY_ENV];
  if (!raw) {
    throw new Error(`${ENCRYPTION_KEY_ENV} is not configured in this function's environment`);
  }
  return createHash('sha256').update(raw).digest();
}

export function decryptLlmSecret(record: IEncryptedSecretRecord): string {
  const key = deriveKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function isLlmEncryptionAvailable(): boolean {
  return Boolean(process.env[ENCRYPTION_KEY_ENV]);
}
