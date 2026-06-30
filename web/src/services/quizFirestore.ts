import type { Quiz } from '@shared-types';
import { fetchUserDoc, toFirestoreDoc } from './firestoreReadUtils';

export function toQuiz(id: string, raw: Parameters<typeof toFirestoreDoc<Quiz>>[1]): Quiz {
  return toFirestoreDoc<Quiz>(id, raw);
}

export function fetchQuizFromFirestore(userId: string, quizId: string): Promise<Quiz | null> {
  return fetchUserDoc<Quiz>(userId, 'quizzes', quizId);
}
