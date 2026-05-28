import { useEffect } from 'react';
import { Timestamp, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppDispatch } from '../../../hooks/redux';
import { directoryApi } from '../../../store/api/Directory/DirectoryApi';
import type { DocumentEnhanced } from '@shared-types';

/** Converts Firestore Timestamps to ISO strings so Redux stays serializable. */
function serializeTimestamp(value: unknown): string | unknown {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return value;
}

/**
 * Sets up a dedicated Firestore real-time listener for documents in the given
 * directory and immediately patches the RTK Query cache when documents are
 * added, modified, or removed.
 *
 * This is an optimistic-update companion to the invalidation-based listener in
 * `useRealtimeDirectorySync`. Because RTK Query's refetch cycle can take
 * 100–500 ms (Firebase callable round-trip), a document that transitions from
 * `pending` → `completed` very quickly (or in the emulator where Gemini
 * returns instantly) would never be visible as pending if we relied solely on
 * `invalidateTags`. The direct cache patch here makes the pending state appear
 * in the UI the moment Firestore delivers the snapshot, independent of the
 * refetch latency.
 *
 * The initial snapshot is intentionally skipped — the RTK Query fetch already
 * populates the cache on page load.
 */
export const useDirectoryDocumentsRealtimeCache = (
  directoryId: string | null,
  artifactLimit: number,
) => {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const uid = user?.uid;

  useEffect(() => {
    if (!uid || !directoryId) return;

    const q = query(
      collection(db, 'users', uid, 'documents'),
      where('directoryId', '==', directoryId),
    );

    const queryArgs = { directoryId, artifactLimit };
    let isInitial = true;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (isInitial) {
          isInitial = false;
          return;
        }

        for (const change of snapshot.docChanges()) {
          const raw = change.doc.data();
          const docData = {
            id: change.doc.id,
            ...raw,
            createdAt: serializeTimestamp(raw.createdAt),
            updatedAt: serializeTimestamp(raw.updatedAt),
            completedAt: serializeTimestamp(raw.completedAt),
          } as DocumentEnhanced;

          if (change.type === 'added' || change.type === 'modified') {
            dispatch(
              directoryApi.util.updateQueryData(
                'getDirectoryContentsWithArtifactSummaries',
                queryArgs,
                (draft) => {
                  const idx = draft.documents.findIndex((d) => d.id === docData.id);
                  if (idx >= 0) {
                    Object.assign(draft.documents[idx], docData);
                  } else {
                    draft.documents.unshift(docData);
                  }
                },
              ),
            );
          } else if (change.type === 'removed') {
            dispatch(
              directoryApi.util.updateQueryData(
                'getDirectoryContentsWithArtifactSummaries',
                queryArgs,
                (draft) => {
                  const idx = draft.documents.findIndex((d) => d.id === docData.id);
                  if (idx >= 0) {
                    draft.documents.splice(idx, 1);
                  }
                },
              ),
            );
          }
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => {},
    );

    return unsubscribe;
  }, [uid, directoryId, artifactLimit, dispatch]);
};
