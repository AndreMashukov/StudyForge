import {
  collection,
  getDocsFromServer,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { DirectoryItemSummary } from '@shared-types';
import { db } from '../config/firebase';
import { serializeCommonTimestamps } from '../hooks/directoryRealtimeCacheUtils';

export function toDirectoryItemSummary(
  id: string,
  raw: Record<string, unknown>,
): DirectoryItemSummary {
  return {
    id,
    ...serializeCommonTimestamps(raw),
  } as DirectoryItemSummary;
}

export async function fetchDirectoryItemsFromFirestore(
  userId: string,
  directoryId: string,
): Promise<DirectoryItemSummary[]> {
  const itemsRef = collection(
    db,
    'users',
    userId,
    'directories',
    directoryId,
    'items',
  );
  // Bypass persistentLocalCache. createDirectory no longer invalidates this
  // query, but other mutations still refetch; a stale getDocs can hide items.
  const snapshot = await getDocsFromServer(itemsRef);
  return snapshot.docs.map((doc) => toDirectoryItemSummary(doc.id, doc.data()));
}

export function subscribeToDirectoryItems(
  userId: string,
  directoryId: string,
  onUpdate: (items: DirectoryItemSummary[]) => void,
): Unsubscribe {
  const itemsRef = collection(
    db,
    'users',
    userId,
    'directories',
    directoryId,
    'items',
  );
  return onSnapshot(
    itemsRef,
    (snapshot) => {
      // Cached snapshots can overwrite a just-created subdirectory before the
      // Admin SDK write is in the client persistence layer.
      if (snapshot.metadata.fromCache) {
        return;
      }
      const items = snapshot.docs.map((doc) =>
        toDirectoryItemSummary(doc.id, doc.data()),
      );
      onUpdate(items);
    },
    () => {
      // Listener errors fall back to callable refetch via RTK defaults.
    },
  );
}
