import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppDispatch } from '../../../hooks/redux';
import { useFirestoreEffect } from '../../../hooks/useFirestoreEffect';
import { patchDocumentInDirectoryContentsCache } from '../../../hooks/directoryRealtimeCacheUtils';

export interface IDirectoryDocumentsRealtimeCacheOptions {
  artifactLimit?: number;
  /** Patch `getDirectoryContentsWithArtifactSummaries` (directory detail page). */
  patchArtifactSummaries?: boolean;
  /** Patch `getDirectoryContents` (documents library page). */
  patchDirectoryContents?: boolean;
}

/**
 * Keeps directory listing caches fresh.
 *
 * - Directory detail artifact summaries: handled by RTK `onCacheEntryAdded` on
 *   `getDirectoryContentsWithArtifactSummaries` (single `items` subcollection listener).
 * - Documents library: still listens to canonical `documents` collection when enabled.
 */
export const useDirectoryDocumentsRealtimeCache = (
  directoryId: string | null,
  options: IDirectoryDocumentsRealtimeCacheOptions = {},
) => {
  const {
    patchArtifactSummaries = true,
    patchDirectoryContents = false,
  } = options;
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const uid = user?.uid;

  useFirestoreEffect(() => {
    if (!uid || !directoryId) {
      return;
    }

    if (!patchDirectoryContents) {
      return;
    }

    if (patchArtifactSummaries) {
      // RTK Query owns the materialized index listener for directory detail.
      return;
    }

    let active = true;
    const directoryQuery = query(
      collection(db, 'users', uid, 'documents'),
      where('directoryId', '==', directoryId),
      limit(100),
    );

    const unsubscribe = onSnapshot(
      directoryQuery,
      (snapshot) => {
        if (!active) {
          return;
        }

        for (const change of snapshot.docChanges()) {
          patchDocumentInDirectoryContentsCache(dispatch, directoryId, change);
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => {},
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [uid, directoryId, patchArtifactSummaries, patchDirectoryContents, dispatch]);
};
