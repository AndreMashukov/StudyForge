import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getClientDb } from '@studyforge/client-data/clientDb';
import type { ILibraryItemRef } from './itemNavigation';

/** Quizzes and flashcard sets generated from one document, for the reader's "Study this" list. */
export function useDocumentArtifacts(
  userId: string | undefined,
  documentId: string | undefined,
) {
  return useQuery({
    queryKey: ['documentArtifacts', userId ?? '', documentId ?? ''],
    enabled: Boolean(userId && documentId),
    queryFn: async (): Promise<
      Array<ILibraryItemRef & { generationStatus?: string }>
    > => {
      if (!userId || !documentId) return [];
      const db = getClientDb();
      const [quizzes, flashcardSets] = await Promise.all([
        getDocs(
          query(
            collection(db, 'users', userId, 'quizzes'),
            where('documentId', '==', documentId),
          ),
        ),
        getDocs(
          query(
            collection(db, 'users', userId, 'flashcardSets'),
            where('documentId', '==', documentId),
          ),
        ),
      ]);
      const toRef =
        (itemType: 'quiz' | 'flashcard') =>
        (snapshot: (typeof quizzes.docs)[number]) => {
          const data = snapshot.data();
          return {
            itemType,
            id: snapshot.id,
            title:
              typeof data.title === 'string'
                ? data.title
                : itemType === 'quiz'
                  ? 'Quiz'
                  : 'Flashcards',
            directoryId:
              typeof data.directoryId === 'string'
                ? data.directoryId
                : undefined,
            generationStatus:
              typeof data.generationStatus === 'string'
                ? data.generationStatus
                : undefined,
          };
        };
      return [
        ...quizzes.docs.map(toRef('quiz')),
        ...flashcardSets.docs.map(toRef('flashcard')),
      ];
    },
  });
}
