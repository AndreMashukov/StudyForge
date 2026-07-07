import { useMemo } from 'react';
import { useAppSelector } from '../../../../hooks/redux';
import { selectSelectedDirectoryId } from '../../../../store/slices/directorySlice';
import {
  useFirestoreRealtimeSync,
  FirestoreListenerConfig,
} from '../../../../hooks/useFirestoreRealtimeSync';

/**
 * Listens to Firestore for real-time changes in the current directory:
 * subdirectories, documents, quizzes, flashcard sets, slide decks,
 * diagram quizzes, and sequence quizzes.
 *
 * When any change is detected, the corresponding RTK Query cache tags
 * are invalidated, triggering a refetch of `getDirectoryContents*`.
 *
 * @param overrideDirectoryId - When provided (e.g. from useParams in
 *   DirectoryDetailPage), this value is used instead of the Redux
 *   `selectedDirectoryId` selector. Pass `null` explicitly for root.
 * @param options.subdirectoriesOnly - When true, only listen for subfolder
 *   changes. Use alongside `useDirectoryDocumentsRealtimeCache` to avoid
 *   duplicate watch targets on the same queries (Firestore SDK ca9 bug).
 */
export const useRealtimeDirectorySync = (
  overrideDirectoryId?: string | null,
  options?: { subdirectoriesOnly?: boolean },
) => {
  const reduxDirectoryId = useAppSelector(selectSelectedDirectoryId);
  const directoryId =
    overrideDirectoryId !== undefined ? overrideDirectoryId : reduxDirectoryId;
  const subdirectoriesOnly = options?.subdirectoriesOnly ?? false;

  const configs: FirestoreListenerConfig[] = useMemo(() => {
    if (directoryId === undefined) {
      return [];
    }

    const dirValue = directoryId ?? null;

    const directoryTags = [
      { type: 'Directory' as const, id: directoryId || 'ROOT' },
    ];

    const subdirectoryConfig: FirestoreListenerConfig = {
      collectionName: 'directories',
      filters: [{ field: 'parentId', value: dirValue }],
      tags: directoryTags,
    };

    if (subdirectoriesOnly) {
      return [subdirectoryConfig];
    }

    return [
      subdirectoryConfig,
      // Documents in the current directory
      {
        collectionName: 'documents',
        filters: [{ field: 'directoryId', value: dirValue }],
        listLimit: 100,
        invalidateOnInitial: true,
        tags: [...directoryTags, 'Documents' as const],
      },
      // Quizzes in the current directory
      {
        collectionName: 'quizzes',
        filters: [{ field: 'directoryId', value: dirValue }],
        listLimit: 50,
        tags: [...directoryTags, 'UserQuizzes' as const],
      },
      // Flashcard sets in the current directory
      {
        collectionName: 'flashcardSets',
        filters: [{ field: 'directoryId', value: dirValue }],
        listLimit: 50,
        tags: [...directoryTags, 'UserFlashcardSets' as const],
      },
      // Slide decks in the current directory
      {
        collectionName: 'slideDecks',
        filters: [{ field: 'directoryId', value: dirValue }],
        listLimit: 50,
        tags: [...directoryTags, 'UserSlideDecks' as const],
      },
      // Diagram quizzes in the current directory
      {
        collectionName: 'diagramQuizzes',
        filters: [{ field: 'directoryId', value: dirValue }],
        listLimit: 50,
        tags: [...directoryTags, 'UserDiagramQuizzes' as const],
      },
      // Sequence quizzes in the current directory
      {
        collectionName: 'sequenceQuizzes',
        filters: [{ field: 'directoryId', value: dirValue }],
        listLimit: 50,
        tags: [...directoryTags, 'UserSequenceQuizzes' as const],
      },
      {
        collectionName: 'subjectWorlds',
        filters: [{ field: 'directoryId', value: dirValue }],
        listLimit: 50,
        tags: [...directoryTags, 'UserSubjectWorlds' as const],
      },
    ];
  }, [directoryId, subdirectoriesOnly]);

  useFirestoreRealtimeSync(configs);
};
