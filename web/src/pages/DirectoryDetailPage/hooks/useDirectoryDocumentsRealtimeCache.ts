import { useEffect } from 'react';
import { Timestamp, collection, onSnapshot, query, where, type DocumentData } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppDispatch } from '../../../hooks/redux';
import { directoryApi } from '../../../store/api/Directory/DirectoryApi';
import type { ArtifactSummary, ArtifactSummaryType, DocumentEnhanced } from '@shared-types';

interface RealtimeCollectionConfig {
  collectionName: string;
  artifactType?: ArtifactSummaryType;
}

const REALTIME_COLLECTIONS: RealtimeCollectionConfig[] = [
  { collectionName: 'documents' },
  { collectionName: 'quizzes', artifactType: 'quiz' },
  { collectionName: 'flashcardSets', artifactType: 'flashcard' },
  { collectionName: 'slideDecks', artifactType: 'slideDeck' },
  { collectionName: 'diagramQuizzes', artifactType: 'diagramQuiz' },
  { collectionName: 'sequenceQuizzes', artifactType: 'sequenceQuiz' },
];

/** Converts Firestore Timestamps to ISO strings so Redux stays serializable. */
function serializeTimestamp(value: unknown): string | unknown {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return value;
}

function serializeCommonTimestamps<T extends Record<string, unknown>>(data: T): T {
  return {
    ...data,
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
    completedAt: serializeTimestamp(data.completedAt),
  };
}

function toDocumentEnhanced(id: string, raw: DocumentData): DocumentEnhanced {
  return {
    id,
    ...serializeCommonTimestamps(raw),
  } as DocumentEnhanced;
}

function toArtifactSummary(id: string, raw: DocumentData, type: ArtifactSummaryType): ArtifactSummary {
  const data = serializeCommonTimestamps(raw);
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Untitled',
    createdAt: data.createdAt as ArtifactSummary['createdAt'],
    type,
    appliedRuleIds: Array.isArray(data.appliedRuleIds) ? data.appliedRuleIds.filter((ruleId): ruleId is string => typeof ruleId === 'string') : [],
    generationStatus: data.generationStatus as ArtifactSummary['generationStatus'] | undefined,
    generationError: typeof data.generationError === 'string' ? data.generationError : undefined,
  };
}

/**
 * Sets up dedicated Firestore real-time listeners for documents and generated
 * artifacts in the given directory, then immediately patches the RTK Query
 * cache when records are added, modified, or removed.
 *
 * This is an optimistic-update companion to the invalidation-based listener in
 * `useRealtimeDirectorySync`. Because RTK Query's refetch cycle can take
 * 100–500 ms (Firebase callable round-trip), a document that transitions from
 * `pending` → `completed` very quickly (or in the emulator where Gemini
 * returns instantly) would never be visible as pending if we relied solely on
 * `invalidateTags`. The direct cache patch here makes pending states appear
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

    const queryArgs = { directoryId, artifactLimit };
    const unsubscribes = REALTIME_COLLECTIONS.map((config) => {
      const q = query(
        collection(db, 'users', uid, config.collectionName),
        where('directoryId', '==', directoryId),
      );

      let isInitial = true;

      return onSnapshot(
        q,
        (snapshot) => {
          if (isInitial) {
            isInitial = false;
            return;
          }

          for (const change of snapshot.docChanges()) {
            const raw = change.doc.data();
            dispatch(
              directoryApi.util.updateQueryData(
                'getDirectoryContentsWithArtifactSummaries',
                queryArgs,
                (draft) => {
                  if (!config.artifactType) {
                    const docData = toDocumentEnhanced(change.doc.id, raw);
                    const idx = draft.documents.findIndex((d) => d.id === docData.id);
                    if (change.type === 'removed') {
                      if (idx >= 0) draft.documents.splice(idx, 1);
                    } else if (idx >= 0) {
                      Object.assign(draft.documents[idx], docData);
                    } else {
                      draft.documents.unshift(docData);
                    }
                    return;
                  }

                  const artifact = toArtifactSummary(change.doc.id, raw, config.artifactType);
                  const idx = draft.artifactSummaries.findIndex(
                    (summary) => summary.id === artifact.id && summary.type === artifact.type,
                  );
                  if (change.type === 'removed') {
                    if (idx >= 0) draft.artifactSummaries.splice(idx, 1);
                  } else if (idx >= 0) {
                    Object.assign(draft.artifactSummaries[idx], artifact);
                  } else {
                    draft.artifactSummaries.unshift(artifact);
                  }
                },
              ),
            );
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        () => {},
      );
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [uid, directoryId, artifactLimit, dispatch]);
};
