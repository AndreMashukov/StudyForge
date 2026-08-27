import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { z } from 'zod';
import { db } from '../config/firebase';
import { sha256HexPrefix } from '../utils/sha256Hex';
import { flashcardSetRef } from './firestorePaths';

export function normalizeVocabularyTerm(term: string): string {
  return term
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

async function learnedVocabularyDocId(
  languageCode: string,
  normalizedTerm: string,
): Promise<string> {
  const hash = await sha256HexPrefix(normalizedTerm, 24);
  const safeLanguage = languageCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${safeLanguage}_${hash}`;
}

const flashcardSetLearnedVocabSchema = z.object({
  isLanguageLearning: z.boolean().optional(),
  targetLanguageCode: z.string().optional(),
  targetLanguageName: z.string().optional(),
  flashcards: z.array(
    z.object({
      id: z.string(),
      front: z.string(),
      term: z.string().optional(),
    }).passthrough(),
  ),
});

type IFlashcardSetLearnedVocabRecord = z.infer<typeof flashcardSetLearnedVocabSchema>;

function parseFlashcardSetLearnedVocab(
  value: unknown,
): IFlashcardSetLearnedVocabRecord | null {
  const parsed = flashcardSetLearnedVocabSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function recordLearnedVocabularyInFirestore(params: {
  userId: string;
  flashcardSetId: string;
  flashcardId: string;
  term?: string;
}): Promise<{ id: string; created: boolean }> {
  const snap = await getDoc(flashcardSetRef(params.userId, params.flashcardSetId));
  if (!snap.exists()) {
    throw new Error('Flashcard set not found.');
  }

  const raw = parseFlashcardSetLearnedVocab(snap.data());
  if (!raw) {
    throw new Error('Flashcard set not found.');
  }

  if (
    !raw.isLanguageLearning
    || !raw.targetLanguageCode?.trim()
    || !raw.targetLanguageName?.trim()
  ) {
    throw new Error(
      'Learned vocabulary is only available for language-learning flashcard sets.',
    );
  }

  const card = raw.flashcards.find((entry) => entry.id === params.flashcardId);
  if (!card) {
    throw new Error('Flashcard not found in set.');
  }

  const term = (params.term ?? card.term)?.trim() ?? '';
  if (!term) {
    throw new Error('Flashcard term is required to record learned vocabulary.');
  }

  const languageCode = raw.targetLanguageCode.trim().toLowerCase();
  const normalizedTerm = normalizeVocabularyTerm(term);
  const id = await learnedVocabularyDocId(languageCode, normalizedTerm);
  const vocabRef = doc(db, 'users', params.userId, 'learnedVocabulary', id);

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(vocabRef);
    if (existing.exists()) {
      transaction.update(vocabRef, {
        term: term.trim(),
        languageName: raw.targetLanguageName?.trim(),
        sourceFlashcardSetId: params.flashcardSetId,
        sourceFlashcardId: params.flashcardId,
        updatedAt: serverTimestamp(),
      });
      return { id, created: false };
    }

    transaction.set(vocabRef, {
      id,
      userId: params.userId,
      languageCode,
      languageName: raw.targetLanguageName?.trim(),
      normalizedTerm,
      term: term.trim(),
      sourceFlashcardSetId: params.flashcardSetId,
      sourceFlashcardId: params.flashcardId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id, created: true };
  });
}
