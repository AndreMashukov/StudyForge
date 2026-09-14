import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import type {
  FlashcardSet,
  RecordFlashcardStudySessionRequest,
} from '@shared-types';
import { computeExpiresAt } from './firestoreTtl';
import { flashcardSetRef, flashcardStudySessionCollection } from './firestorePaths';

function parseDate(value: string | undefined, fieldName: string): Date {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date string`);
  }
  return date;
}

async function resolveFlashcardSet(
  userId: string,
  flashcardSetId: string,
): Promise<FlashcardSet> {
  const snap = await getDoc(flashcardSetRef(userId, flashcardSetId));
  if (!snap.exists()) {
    throw new Error(`Flashcard set ${flashcardSetId} not found`);
  }
  return { id: snap.id, ...snap.data() } as FlashcardSet;
}

export async function recordFlashcardStudySessionInFirestore(
  userId: string,
  data: RecordFlashcardStudySessionRequest,
): Promise<string> {
  if (!data.flashcardSetId) {
    throw new Error('flashcardSetId is required');
  }

  const markedCards = (data.cards ?? []).filter(
    (card) => card.outcome === 'failed' || card.outcome === 'learned',
  );
  if (markedCards.length === 0) {
    throw new Error('At least one marked card is required');
  }

  const startedAt = parseDate(data.startedAt, 'startedAt');
  const completedAt = parseDate(data.completedAt, 'completedAt');
  const date = completedAt.toISOString().slice(0, 10);
  const flashcardSet = await resolveFlashcardSet(userId, data.flashcardSetId);
  const documentIds =
    flashcardSet.documentIds && flashcardSet.documentIds.length > 0
      ? flashcardSet.documentIds
      : flashcardSet.documentId
        ? [flashcardSet.documentId]
        : [];

  const sessionRef = doc(flashcardStudySessionCollection(userId));
  await setDoc(sessionRef, {
    id: sessionRef.id,
    userId,
    flashcardSetId: data.flashcardSetId,
    directoryId: flashcardSet.directoryId,
    documentIds,
    startedAt: Timestamp.fromDate(startedAt),
    completedAt: Timestamp.fromDate(completedAt),
    cards: markedCards,
    date,
    expiresAt: computeExpiresAt(completedAt, 'learningRaw'),
  });

  return sessionRef.id;
}
