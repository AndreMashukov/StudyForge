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
 */
export const useRealtimeDirectorySync = () => {
  const directoryId = useAppSelector(selectSelectedDirectoryId);

  const configs: FirestoreListenerConfig[] = useMemo(() => {
    const dirValue = directoryId ?? null;

    const directoryTags = [
      { type: 'Directory' as const, id: directoryId || 'ROOT' },
      { type: 'Directory' as const, id: 'CONTENTS' },
    ];

    return [
      // Subdirectories of the current directory
      {
        collectionName: 'directories',
        filters: [{ field: 'parentId', value: dirValue }],
        tags: directoryTags,
      },
      // Documents in the current directory
      {
        collectionName: 'documents',
        filters: [{ field: 'directoryId', value: dirValue }],
        tags: [...directoryTags, 'Documents' as const],
      },
      // Quizzes in the current directory
      {
        collectionName: 'quizzes',
        filters: [{ field: 'directoryId', value: dirValue }],
        tags: [...directoryTags, 'UserQuizzes' as const],
      },
      // Flashcard sets in the current directory
      {
        collectionName: 'flashcardSets',
        filters: [{ field: 'directoryId', value: dirValue }],
        tags: [...directoryTags, 'UserFlashcardSets' as const],
      },
      // Slide decks in the current directory
      {
        collectionName: 'slideDecks',
        filters: [{ field: 'directoryId', value: dirValue }],
        tags: [...directoryTags, 'UserSlideDecks' as const],
      },
      // Diagram quizzes in the current directory
      {
        collectionName: 'diagramQuizzes',
        filters: [{ field: 'directoryId', value: dirValue }],
        tags: [...directoryTags, 'UserDiagramQuizzes' as const],
      },
      // Sequence quizzes in the current directory
      {
        collectionName: 'sequenceQuizzes',
        filters: [{ field: 'directoryId', value: dirValue }],
        tags: [...directoryTags, 'UserSequenceQuizzes' as const],
      },
    ];
  }, [directoryId]);

  useFirestoreRealtimeSync(configs);
};
