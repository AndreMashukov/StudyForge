import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppDispatch } from '../../../hooks/redux';
import { useFirestoreEffect } from '../../../hooks/useFirestoreEffect';
import type { ArtifactSummaryType } from '@shared-types';
import {
  patchArtifactInSummariesCache,
  patchDocumentInArtifactSummariesCache,
  patchDocumentInDirectoryContentsCache,
} from '../../../hooks/directoryRealtimeCacheUtils';

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
  { collectionName: 'subjectWorlds', artifactType: 'subjectWorld' },
];

export interface IDirectoryDocumentsRealtimeCacheOptions {
  artifactLimit?: number;
  /** Patch `getDirectoryContentsWithArtifactSummaries` (directory detail page). */
  patchArtifactSummaries?: boolean;
  /** Patch `getDirectoryContents` (documents library page). */
  patchDirectoryContents?: boolean;
}

/**
 * Sets up Firestore real-time listeners for documents and generated artifacts in
 * the given directory, then immediately patches the RTK Query cache when records
 * change.
 *
 * The initial snapshot is processed to backfill records created between the
 * RTK Query fetch and listener subscription; patch helpers only add when missing.
 */
export const useDirectoryDocumentsRealtimeCache = (
  directoryId: string | null,
  options: IDirectoryDocumentsRealtimeCacheOptions = {},
) => {
  const {
    artifactLimit = 20,
    patchArtifactSummaries = true,
    patchDirectoryContents = false,
  } = options;
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const uid = user?.uid;

  useFirestoreEffect(() => {
    if (!uid) {
      return;
    }

    if (!patchArtifactSummaries && !patchDirectoryContents) {
      return;
    }

    if (!directoryId) {
      return;
    }

    let active = true;

    const collections = REALTIME_COLLECTIONS.filter((config) => {
      if (config.artifactType) {
        return patchArtifactSummaries;
      }
      return patchArtifactSummaries || patchDirectoryContents;
    });

    const unsubscribes = collections.map((config) => {
      const directoryQuery = query(
        collection(db, 'users', uid, config.collectionName),
        where('directoryId', '==', directoryId),
      );

      let isInitial = true;

      return onSnapshot(
        directoryQuery,
        (snapshot) => {
          if (!active) {
            return;
          }
          if (isInitial) {
            isInitial = false;
          }

          for (const change of snapshot.docChanges()) {
            if (!config.artifactType) {
              if (patchDirectoryContents) {
                patchDocumentInDirectoryContentsCache(dispatch, directoryId, change);
              }
              if (patchArtifactSummaries && directoryId) {
                patchDocumentInArtifactSummariesCache(
                  dispatch,
                  directoryId,
                  artifactLimit,
                  change,
                );
              }
              continue;
            }

            if (patchArtifactSummaries && directoryId) {
              patchArtifactInSummariesCache(
                dispatch,
                directoryId,
                artifactLimit,
                change,
                config.artifactType,
              );
            }
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        () => {},
      );
    });

    return () => {
      active = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    uid,
    directoryId,
    artifactLimit,
    patchArtifactSummaries,
    patchDirectoryContents,
    dispatch,
  ]);
};
