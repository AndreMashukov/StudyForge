import type { Firestore } from 'firebase/firestore';

/** Hex SHA-256 digest of a UTF-8 string. Injected because React Native has no `crypto.subtle`. */
export type Sha256Hex = (value: string) => Promise<string>;

export interface IClientDataConfig {
  db: Firestore;
  sha256Hex?: Sha256Hex;
}

let config: IClientDataConfig | null = null;

/**
 * Configure once at app start with the app's Firestore instance.
 * Web and mobile each own their Firebase setup; this library never imports it.
 */
export function configureClientData(next: IClientDataConfig): void {
  config = next;
}

export function getClientDb(): Firestore {
  if (!config) {
    throw new Error(
      'client-data is not configured. Call configureClientData() at app start.',
    );
  }
  return config.db;
}

async function subtleSha256Hex(value: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error(
      'No SHA-256 implementation. Pass sha256Hex to configureClientData().',
    );
  }
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256HexPrefix(
  value: string,
  length: number,
): Promise<string> {
  const hash = config?.sha256Hex ?? subtleSha256Hex;
  const hex = await hash(value);
  return hex.slice(0, length);
}
