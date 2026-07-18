import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { FirestorePaths } from '../../lib/firestore-paths';

export function normalizeVocabularyTerm(term: string): string {
  return term
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

/** Snapshot fields required to record learned vocabulary from a flashcard set. */
export interface FlashcardSetLearnedVocabRecord {
  isLanguageLearning?: boolean;
  targetLanguageCode?: string;
  targetLanguageName?: string;
  flashcards: Array<{ id: string; front: string }>;
}

export function isFlashcardSetLearnedVocabRecord(
  value: unknown
): value is FlashcardSetLearnedVocabRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.flashcards)) {
    return false;
  }

  if (
    record.isLanguageLearning !== undefined
    && typeof record.isLanguageLearning !== 'boolean'
  ) {
    return false;
  }
  if (
    record.targetLanguageCode !== undefined
    && typeof record.targetLanguageCode !== 'string'
  ) {
    return false;
  }
  if (
    record.targetLanguageName !== undefined
    && typeof record.targetLanguageName !== 'string'
  ) {
    return false;
  }

  return record.flashcards.every((card) => {
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      return false;
    }
    const entry = card as Record<string, unknown>;
    return typeof entry.id === 'string' && typeof entry.front === 'string';
  });
}

export type RecordLearnedVocabularyFailureCode =
  | 'not-found'
  | 'failed-precondition'
  | 'invalid-argument';

export class RecordLearnedVocabularyError extends Error {
  readonly code: RecordLearnedVocabularyFailureCode;

  constructor(code: RecordLearnedVocabularyFailureCode, message: string) {
    super(message);
    this.name = 'RecordLearnedVocabularyError';
    this.code = code;
  }
}

export function isRecordLearnedVocabularyError(
  error: unknown
): error is RecordLearnedVocabularyError {
  return error instanceof RecordLearnedVocabularyError;
}

export interface RecordLearnedVocabularyFromFlashcardParams {
  userId: string;
  flashcardSetId: string;
  flashcardId: string;
  term?: string;
}

/**
 * Load a flashcard set, validate language-learning eligibility, and upsert
 * the card's term into the user's learned vocabulary.
 */
export async function recordLearnedVocabularyFromFlashcard(
  params: RecordLearnedVocabularyFromFlashcardParams
): Promise<{ id: string; created: boolean }> {
  const snap = await FirestorePaths.flashcardSet(
    params.userId,
    params.flashcardSetId
  ).get();

  if (!snap.exists) {
    throw new RecordLearnedVocabularyError('not-found', 'Flashcard set not found.');
  }

  const raw = snap.data();
  if (!isFlashcardSetLearnedVocabRecord(raw)) {
    throw new RecordLearnedVocabularyError('not-found', 'Flashcard set not found.');
  }

  if (
    !raw.isLanguageLearning
    || !raw.targetLanguageCode?.trim()
    || !raw.targetLanguageName?.trim()
  ) {
    throw new RecordLearnedVocabularyError(
      'failed-precondition',
      'Learned vocabulary is only available for language-learning flashcard sets.'
    );
  }

  const card = raw.flashcards.find((entry) => entry.id === params.flashcardId);
  if (!card) {
    throw new RecordLearnedVocabularyError('not-found', 'Flashcard not found in set.');
  }

  const term = (params.term ?? card.front).trim();
  if (!term) {
    throw new RecordLearnedVocabularyError('invalid-argument', 'Term is required.');
  }

  return upsertLearnedVocabularyItem({
    userId: params.userId,
    languageCode: raw.targetLanguageCode,
    languageName: raw.targetLanguageName,
    term,
    sourceFlashcardSetId: params.flashcardSetId,
    sourceFlashcardId: params.flashcardId,
  });
}

export function learnedVocabularyDocId(languageCode: string, normalizedTerm: string): string {
  const hash = createHash('sha256').update(normalizedTerm).digest('hex').slice(0, 24);
  const safeLanguage = languageCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${safeLanguage}_${hash}`;
}

export async function listLearnedVocabularyTerms(
  userId: string,
  languageCode: string,
  limit = 500
): Promise<string[]> {
  const snap = await FirestorePaths.learnedVocabulary(userId)
    .where('languageCode', '==', languageCode.trim().toLowerCase())
    .limit(limit)
    .get();

  return snap.docs
    .map((doc) => {
      const data = doc.data() as { normalizedTerm?: string };
      return typeof data.normalizedTerm === 'string' ? data.normalizedTerm : '';
    })
    .filter((term) => term.length > 0);
}

export interface UpsertLearnedVocabularyParams {
  userId: string;
  languageCode: string;
  languageName: string;
  term: string;
  sourceFlashcardSetId?: string;
  sourceFlashcardId?: string;
}

export async function upsertLearnedVocabularyItem(
  params: UpsertLearnedVocabularyParams
): Promise<{ id: string; created: boolean }> {
  const languageCode = params.languageCode.trim().toLowerCase();
  const normalizedTerm = normalizeVocabularyTerm(params.term);
  if (!languageCode || !normalizedTerm) {
    throw new Error('languageCode and term are required');
  }

  const id = learnedVocabularyDocId(languageCode, normalizedTerm);
  const ref = FirestorePaths.learnedVocabularyItem(params.userId, id);

  return ref.firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);

    if (existing.exists) {
      transaction.update(ref, {
        term: params.term.trim(),
        languageName: params.languageName.trim(),
        ...(params.sourceFlashcardSetId
          ? { sourceFlashcardSetId: params.sourceFlashcardSetId }
          : {}),
        ...(params.sourceFlashcardId ? { sourceFlashcardId: params.sourceFlashcardId } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { id, created: false };
    }

    transaction.set(ref, {
      id,
      userId: params.userId,
      languageCode,
      languageName: params.languageName.trim(),
      normalizedTerm,
      term: params.term.trim(),
      ...(params.sourceFlashcardSetId
        ? { sourceFlashcardSetId: params.sourceFlashcardSetId }
        : {}),
      ...(params.sourceFlashcardId ? { sourceFlashcardId: params.sourceFlashcardId } : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { id, created: true };
  });
}
