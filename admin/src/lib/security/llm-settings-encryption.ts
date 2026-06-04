import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import type { IEncryptedSecretRecord } from '@shared-types';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_ENV_NAME = 'LLM_SETTINGS_ENCRYPTION_KEY';
const IV_LENGTH = 12;

function getEncryptionSecret(): string {
  const value = process.env[ENCRYPTION_KEY_ENV_NAME];

  if (!value) {
    throw new Error(`${ENCRYPTION_KEY_ENV_NAME} is not configured.`);
  }

  return value;
}

function getEncryptionKey(): Buffer {
  return createHash('sha256').update(getEncryptionSecret()).digest();
}

export function isLlmSettingsEncryptionConfigured(): boolean {
  return Boolean(process.env[ENCRYPTION_KEY_ENV_NAME]);
}

export function encryptSecret(value: string): IEncryptedSecretRecord {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error('Secret value cannot be empty.');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalizedValue, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: ENCRYPTION_ALGORITHM,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptSecret(record: IEncryptedSecretRecord): string {
  if (record.algorithm !== ENCRYPTION_ALGORITHM) {
    throw new Error(`Unsupported encryption algorithm: ${record.algorithm}`);
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(record.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}