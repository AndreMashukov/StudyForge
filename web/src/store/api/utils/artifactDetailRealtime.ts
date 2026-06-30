import type { DocumentData } from 'firebase/firestore';
import { auth } from '../../../config/firebase';
import { subscribeToUserDoc } from '../../../services/firestoreReadUtils';

interface IAttachArtifactDocListenerArgs<T> {
  collectionName: string;
  docId: string;
  cacheDataLoaded: Promise<unknown>;
  cacheEntryRemoved: Promise<unknown>;
  onMapped: (mapped: T) => void;
  mapSnapshot: (id: string, raw: DocumentData) => T;
}

export async function attachArtifactDocListener<T>({
  collectionName,
  docId,
  cacheDataLoaded,
  cacheEntryRemoved,
  onMapped,
  mapSnapshot,
}: IAttachArtifactDocListenerArgs<T>): Promise<void> {
  try {
    await cacheDataLoaded;
  } catch {
    return;
  }

  const userId = auth.currentUser?.uid;
  if (!userId) {
    await cacheEntryRemoved;
    return;
  }

  const unsubscribe = subscribeToUserDoc(userId, collectionName, docId, (raw, id) => {
    if (!raw) {
      return;
    }
    onMapped(mapSnapshot(id, raw));
  });

  try {
    await cacheEntryRemoved;
  } finally {
    unsubscribe();
  }
}
