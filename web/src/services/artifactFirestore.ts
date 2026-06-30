import type {
  DiagramQuiz,
  FlashcardSet,
  SequenceQuiz,
  SlideDeck,
} from '@shared-types';
import {
  fetchUserCollection,
  fetchUserDoc,
  orderByCreatedAtDesc,
  whereEquals,
} from './firestoreReadUtils';

const USER_FLASHCARD_SETS_LIMIT = 50;
const USER_SLIDE_DECKS_LIMIT = 50;
const USER_DIAGRAM_QUIZZES_LIMIT = 50;
const USER_SEQUENCE_QUIZZES_LIMIT = 50;

export function fetchFlashcardSetFromFirestore(
  userId: string,
  flashcardSetId: string,
): Promise<FlashcardSet | null> {
  return fetchUserDoc<FlashcardSet>(userId, 'flashcardSets', flashcardSetId);
}

export function fetchSlideDeckFromFirestore(
  userId: string,
  slideDeckId: string,
): Promise<SlideDeck | null> {
  return fetchUserDoc<SlideDeck>(userId, 'slideDecks', slideDeckId);
}

export function fetchDiagramQuizFromFirestore(
  userId: string,
  diagramQuizId: string,
): Promise<DiagramQuiz | null> {
  return fetchUserDoc<DiagramQuiz>(userId, 'diagramQuizzes', diagramQuizId);
}

export function fetchSequenceQuizFromFirestore(
  userId: string,
  sequenceQuizId: string,
): Promise<SequenceQuiz | null> {
  return fetchUserDoc<SequenceQuiz>(userId, 'sequenceQuizzes', sequenceQuizId);
}

export function fetchUserFlashcardSetsFromFirestore(userId: string): Promise<FlashcardSet[]> {
  return fetchUserCollection<FlashcardSet>(
    userId,
    'flashcardSets',
    orderByCreatedAtDesc(USER_FLASHCARD_SETS_LIMIT),
  );
}

export function fetchUserSlideDecksFromFirestore(userId: string): Promise<SlideDeck[]> {
  return fetchUserCollection<SlideDeck>(
    userId,
    'slideDecks',
    orderByCreatedAtDesc(USER_SLIDE_DECKS_LIMIT),
  );
}

export function fetchUserDiagramQuizzesFromFirestore(userId: string): Promise<DiagramQuiz[]> {
  return fetchUserCollection<DiagramQuiz>(
    userId,
    'diagramQuizzes',
    orderByCreatedAtDesc(USER_DIAGRAM_QUIZZES_LIMIT),
  );
}

export function fetchUserSequenceQuizzesFromFirestore(userId: string): Promise<SequenceQuiz[]> {
  return fetchUserCollection<SequenceQuiz>(
    userId,
    'sequenceQuizzes',
    orderByCreatedAtDesc(USER_SEQUENCE_QUIZZES_LIMIT),
  );
}

export { whereEquals };
