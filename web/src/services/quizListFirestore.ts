import type { Quiz } from '@shared-types';
import {
  fetchUserCollection,
  orderByCreatedAtDesc,
  whereEquals,
} from './firestoreReadUtils';

const USER_QUIZZES_LIMIT = 50;

export function fetchUserQuizzesFromFirestore(userId: string): Promise<Quiz[]> {
  return fetchUserCollection<Quiz>(userId, 'quizzes', orderByCreatedAtDesc(USER_QUIZZES_LIMIT));
}

export function fetchDocumentQuizzesFromFirestore(
  userId: string,
  documentId: string,
): Promise<Quiz[]> {
  return fetchUserCollection<Quiz>(userId, 'quizzes', [
    whereEquals('documentId', documentId),
    ...orderByCreatedAtDesc(),
  ]);
}
