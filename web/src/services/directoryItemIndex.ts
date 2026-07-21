import {
  collection,
  getDocsFromServer,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { DirectoryItemSummary } from '@shared-types';
import { db } from '../config/firebase';
import { serializeCommonTimestamps } from '../hooks/directoryRealtimeCacheUtils';

export function toDirectoryItemSummary(id: string, raw: Record<string, unknown>): DirectoryItemSummary {
  return {
    id,
    ...serializeCommonTimestamps(raw),
  } as DirectoryItemSummary;
}

export async function fetchDirectoryItemsFromFirestore(
  userId: string,
  directoryId: string,
): Promise<DirectoryItemSummary[]> {
  const itemsRef = collection(db, 'users', userId, 'directories', directoryId, 'items');
  // Bypass persistentLocalCache — Admin SDK index writes are often not in the
  // client cache yet when createDirectory invalidates tags, and a stale getDocs
  // overwrite races the items onSnapshot patch (subdir missing until remount).
  const snapshot = await getDocsFromServer(itemsRef);
  return snapshot.docs.map((doc) => toDirectoryItemSummary(doc.id, doc.data()));
}

export function subscribeToDirectoryItems(
  userId: string,
  directoryId: string,
  onUpdate: (items: DirectoryItemSummary[]) => void,
): Unsubscribe {
  const itemsRef = collection(db, 'users', userId, 'directories', directoryId, 'items');
  return onSnapshot(
    itemsRef,
    (snapshot) => {
      const items = snapshot.docs.map((doc) => toDirectoryItemSummary(doc.id, doc.data()));
      onUpdate(items);
    },
    () => {
      // Listener errors fall back to callable refetch via RTK defaults.
    },
  );
}
