import { getDocs, orderBy, query } from 'firebase/firestore';
import type { IApiKey } from '../store/api/ApiKeys/IApiKeysApi';
import { userCollection } from './firestorePaths';
import { serializeCommonTimestamps } from '../hooks/directoryRealtimeCacheUtils';

function optionalIsoTimestamp(value: unknown): string | null {
  if (
    value
    && typeof value === 'object'
    && 'toDate' in value
    && typeof value.toDate === 'function'
  ) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return null;
}

export async function listApiKeysFromFirestore(userId: string): Promise<IApiKey[]> {
  const snapshot = await getDocs(
    query(userCollection(userId, 'apiKeys'), orderBy('createdAt', 'desc')),
  );

  return snapshot.docs.map((keyDoc) => {
    const data = serializeCommonTimestamps(keyDoc.data());
    return {
      keyId: keyDoc.id,
      name: typeof data.name === 'string' ? data.name : '',
      keyPrefix: typeof data.keyPrefix === 'string' ? data.keyPrefix : '',
      createdAt: optionalIsoTimestamp(data.createdAt),
      lastUsedAt: optionalIsoTimestamp(data.lastUsedAt),
      active: Boolean(data.active),
    };
  });
}
