import { useQuery } from '@tanstack/react-query';
import { getDocFromServer } from 'firebase/firestore';
import { z } from 'zod';
import {
  flashcardSetRef,
  quizRef,
} from '@studyforge/client-data/firestorePaths';
import { queryKeys } from '../../lib/api/queryKeys';

const generationStatusSchema = z
  .enum(['pending', 'completed', 'failed'])
  .optional();

const quizSchema = z.object({
  title: z.string(),
  directoryId: z.string(),
  documentId: z.string().optional(),
  generationStatus: generationStatusSchema,
  generationError: z.string().optional(),
  questions: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()),
        correctAnswer: z.number(),
        hint: z.string().optional(),
      }),
    )
    .default([]),
});

const flashcardSetSchema = z.object({
  title: z.string(),
  directoryId: z.string(),
  documentId: z.string().optional(),
  generationStatus: generationStatusSchema,
  generationError: z.string().optional(),
  isLanguageLearning: z.boolean().optional(),
  flashcards: z
    .array(
      z.object({
        id: z.string(),
        front: z.string(),
        back: z.string(),
        term: z.string().optional(),
        explanation: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .default([]),
});

export type IMobileQuiz = z.infer<typeof quizSchema> & { id: string };
export type IMobileFlashcardSet = z.infer<typeof flashcardSetSchema> & {
  id: string;
};

export function useQuizQuery(
  userId: string | undefined,
  quizId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.artifact(userId ?? '', 'quiz', quizId ?? ''),
    enabled: Boolean(userId && quizId),
    queryFn: async (): Promise<IMobileQuiz | null> => {
      if (!userId || !quizId) throw new Error('Quiz unavailable');
      const snapshot = await getDocFromServer(quizRef(userId, quizId));
      return snapshot.exists()
        ? { ...quizSchema.parse(snapshot.data()), id: snapshot.id }
        : null;
    },
  });
}

export function useFlashcardSetQuery(
  userId: string | undefined,
  flashcardSetId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.artifact(
      userId ?? '',
      'flashcard',
      flashcardSetId ?? '',
    ),
    enabled: Boolean(userId && flashcardSetId),
    queryFn: async (): Promise<IMobileFlashcardSet | null> => {
      if (!userId || !flashcardSetId)
        throw new Error('Flashcard set unavailable');
      const snapshot = await getDocFromServer(
        flashcardSetRef(userId, flashcardSetId),
      );
      return snapshot.exists()
        ? { ...flashcardSetSchema.parse(snapshot.data()), id: snapshot.id }
        : null;
    },
  });
}
