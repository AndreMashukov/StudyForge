import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { GetDirectoryTreeResponse } from '@shared-types';
import { db } from '../config/firebase';
import { toDirectory } from '../hooks/directoryRealtimeCacheUtils';
import { buildDirectoryTreeResponse } from '../utils/directoryTreeUtils';

function directoriesFromSnapshot(snapshot: QuerySnapshot<DocumentData>): GetDirectoryTreeResponse {
  const directories = snapshot.docs.map((doc) => toDirectory(doc.id, doc.data()));
  return buildDirectoryTreeResponse(directories);
}

export async function fetchDirectoryTreeFromFirestore(userId: string): Promise<GetDirectoryTreeResponse> {
  const directoriesQuery = query(
    collection(db, 'users', userId, 'directories'),
    orderBy('path', 'asc'),
  );
  const snapshot = await getDocs(directoriesQuery);
  return directoriesFromSnapshot(snapshot);
}

export function subscribeToDirectoryTreeIndex(
  userId: string,
  onUpdate: (tree: GetDirectoryTreeResponse) => void,
): Unsubscribe {
  const directoriesQuery = query(
    collection(db, 'users', userId, 'directories'),
    orderBy('path', 'asc'),
  );

  return onSnapshot(
    directoriesQuery,
    (snapshot) => {
      onUpdate(directoriesFromSnapshot(snapshot));
    },
    () => {
      // Listener errors are handled by RTK queryFn callable fallback on refetch.
    },
  );
}
