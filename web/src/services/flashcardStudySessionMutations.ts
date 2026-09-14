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
import { parseRequiredIsoDateString } from '../utils/dateUtils';
import { computeExpiresAt } from './firestoreTtl';
import { flashcardSetRef, flashcardStudySessionCollection } from './firestorePaths';

function isFlashcardSetRecord(value: unknown): value is FlashcardSet {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string'
    && typeof record.userId === 'string'
    && typeof record.directoryId === 'string'
    && typeof record.documentId === 'string'
    && Array.isArray(record.flashcards)
  );
}

async function resolveFlashcardSet(
  userId: string,
  flashcardSetId: string,
): Promise<FlashcardSet> {
  const snap = await getDoc(flashcardSetRef(userId, flashcardSetId));
  if (!snap.exists()) {
    throw new Error(`Flashcard set ${flashcardSetId} not found`);
  }

  const candidate = { id: snap.id, ...snap.data() };
  if (!isFlashcardSetRecord(candidate)) {
    throw new Error(`Flashcard set ${flashcardSetId} has invalid data`);
  }

  return candidate;
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

  const startedAt = parseRequiredIsoDateString(data.startedAt, 'startedAt');
  const completedAt = parseRequiredIsoDateString(data.completedAt, 'completedAt');
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
