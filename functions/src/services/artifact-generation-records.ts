/**
 * Artifact Generation Records Service
 *
 * Provides create / complete / fail helpers for each of the five artifact
 * types (quiz, flashcard, slideDeck, diagramQuiz, sequenceQuiz).
 *
 * Design contract:
 *  - createPending* → writes a placeholder record with generationStatus='pending'
 *    and does NOT increment the directory artifact count.
 *  - completePending* → updates the placeholder with generated data,
 *    sets generationStatus='completed', and increments the directory count (once).
 *  - failPending* → sets generationStatus='failed' and stores the error message.
 *    The record stays visible in the UI so users can see what went wrong.
 *
 * Callers that delete a pending/failed record must NOT decrement the directory
 * count because it was never incremented in the first place. The delete endpoints
 * must check generationStatus before adjusting counts.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { FirestorePaths } from '../lib/firestore-paths';
import { GenerationStatus, IArtifactAgentDiagnostics, type IGenerationModelUsage } from '@shared-types';
import { syncArtifactDirectoryIndex, syncIndexSafely } from './directory-item-index';

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) {
        result[key] = stripUndefinedDeep(entry);
      }
    }
    return result as T;
  }
  return value;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Returns true when a record's count should be decremented on delete.
 * A pending or failed record was never counted; a completed or legacy record was.
 */
export function shouldDecrementCountOnDelete(
  generationStatus: GenerationStatus | undefined
): boolean {
  return !generationStatus || generationStatus === 'completed';
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export interface PendingQuizParams {
  directoryId: string;
  documentId: string;
  documentIds?: string[];
  documentTitle: string;
  title: string;
  userId: string;
  followupRuleIds?: string[];
  documentColor?: string;
  documentColors?: string[];
}

export async function createPendingQuiz(params: PendingQuizParams): Promise<string> {
  const ref = FirestorePaths.quizzes(params.userId).doc();
  await ref.set({
    id: ref.id,
    userId: params.userId,
    documentId: params.documentId,
    ...(params.documentIds ? { documentIds: params.documentIds } : {}),
    documentTitle: params.documentTitle,
    title: params.title,
    questions: [],
    directoryId: params.directoryId,
    followupRuleIds: params.followupRuleIds || [],
    appliedRuleIds: [],
    ...(params.documentColor ? { documentColor: params.documentColor } : {}),
    ...(params.documentColors ? { documentColors: params.documentColors } : {}),
    generationStatus: 'pending' as GenerationStatus,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.info('Pending quiz created', { quizId: ref.id, userId: params.userId });
  await syncIndexSafely('createPendingQuiz', () =>
    syncArtifactDirectoryIndex(params.userId, 'quiz', ref.id),
  );
  return ref.id;
}

export async function completePendingQuiz(
  userId: string,
  quizId: string,
  updates: {
    title: string;
    questions: object[];
    appliedRuleIds?: string[];
    generationAttempt?: number;
    generationModel?: string;
    generationModelUsage?: IGenerationModelUsage[];
  }
): Promise<void> {
  const ref = FirestorePaths.quiz(userId, quizId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Pending quiz ${quizId} not found`);
  const data = snap.data() as { directoryId?: string };

  await ref.update({
    title: updates.title,
    questions: updates.questions,
    appliedRuleIds: updates.appliedRuleIds || [],
    generationAttempt: updates.generationAttempt || 1,
    ...(updates.generationModel ? { generationModel: updates.generationModel } : {}),
    ...(updates.generationModelUsage?.length
      ? { generationModelUsage: updates.generationModelUsage }
      : {}),
    generationStatus: 'completed' as GenerationStatus,
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (data.directoryId) {
    await FirestorePaths.directory(userId, data.directoryId).update({
      quizCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  logger.info('Pending quiz completed', { quizId, userId });
  await syncIndexSafely('completePendingQuiz', () =>
    syncArtifactDirectoryIndex(userId, 'quiz', quizId),
  );
}

export async function failPendingQuiz(userId: string, quizId: string, error: string): Promise<void> {
  await FirestorePaths.quiz(userId, quizId).update({
    generationStatus: 'failed' as GenerationStatus,
    generationError: error,
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.warn('Pending quiz marked as failed', { quizId, userId, error });
  await syncIndexSafely('failPendingQuiz', () =>
    syncArtifactDirectoryIndex(userId, 'quiz', quizId),
  );
}

// ─── Flashcard Set ────────────────────────────────────────────────────────────

export interface PendingFlashcardSetParams {
  directoryId: string;
  documentId: string;
  documentIds?: string[];
  documentTitle: string;
  title: string;
  userId: string;
  documentColor?: string;
  documentColors?: string[];
}

export async function createPendingFlashcardSet(params: PendingFlashcardSetParams): Promise<string> {
  const ref = FirestorePaths.flashcardSets(params.userId).doc();
  await ref.set({
    id: ref.id,
    userId: params.userId,
    documentId: params.documentId,
    ...(params.documentIds ? { documentIds: params.documentIds } : {}),
    documentTitle: params.documentTitle,
    title: params.title,
    flashcards: [],
    directoryId: params.directoryId,
    appliedRuleIds: [],
    appliedDescriptionRuleIds: [],
    ...(params.documentColor ? { documentColor: params.documentColor } : {}),
    ...(params.documentColors ? { documentColors: params.documentColors } : {}),
    generationStatus: 'pending' as GenerationStatus,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.info('Pending flashcard set created', { flashcardSetId: ref.id, userId: params.userId });
  await syncIndexSafely('createPendingFlashcardSet', () =>
    syncArtifactDirectoryIndex(params.userId, 'flashcard', ref.id),
  );
  return ref.id;
}

export async function completePendingFlashcardSet(
  userId: string,
  flashcardSetId: string,
  updates: {
    title: string;
    flashcards: object[];
    appliedRuleIds?: string[];
    appliedDescriptionRuleIds?: string[];
    generationModel?: string;
    generationModelUsage?: IGenerationModelUsage[];
    agentModel?: string;
    generationDiagnostics?: IArtifactAgentDiagnostics;
    isLanguageLearning?: boolean;
    languageLearningConfidence?: number;
    targetLanguageCode?: string;
    targetLanguageName?: string;
  }
): Promise<void> {
  const ref = FirestorePaths.flashcardSet(userId, flashcardSetId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Pending flashcard set ${flashcardSetId} not found`);
  const data = snap.data() as { directoryId?: string };

  await ref.update({
    title: updates.title,
    flashcards: updates.flashcards,
    appliedRuleIds: updates.appliedRuleIds || [],
    appliedDescriptionRuleIds: updates.appliedDescriptionRuleIds || [],
    ...(updates.generationModel ? { generationModel: updates.generationModel } : {}),
    ...(updates.generationModelUsage?.length
      ? { generationModelUsage: updates.generationModelUsage }
      : {}),
    ...(updates.agentModel ? { agentModel: updates.agentModel } : {}),
    ...(updates.generationDiagnostics
      ? { generationDiagnostics: stripUndefinedDeep(updates.generationDiagnostics) }
      : {}),
    ...(updates.isLanguageLearning !== undefined
      ? { isLanguageLearning: updates.isLanguageLearning }
      : {}),
    ...(updates.languageLearningConfidence !== undefined
      ? { languageLearningConfidence: updates.languageLearningConfidence }
      : {}),
    ...(updates.targetLanguageCode
      ? { targetLanguageCode: updates.targetLanguageCode }
      : {}),
    ...(updates.targetLanguageName
      ? { targetLanguageName: updates.targetLanguageName }
      : {}),
    generationStatus: 'completed' as GenerationStatus,
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (data.directoryId) {
    await FirestorePaths.directory(userId, data.directoryId).update({
      flashcardSetCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  logger.info('Pending flashcard set completed', { flashcardSetId, userId });
  await syncIndexSafely('completePendingFlashcardSet', () =>
    syncArtifactDirectoryIndex(userId, 'flashcard', flashcardSetId),
  );
}

export async function failPendingFlashcardSet(
  userId: string,
  flashcardSetId: string,
  error: string,
  diagnostics?: IArtifactAgentDiagnostics
): Promise<void> {
  await FirestorePaths.flashcardSet(userId, flashcardSetId).update({
    generationStatus: 'failed' as GenerationStatus,
    generationError: error,
    ...(diagnostics ? { generationDiagnostics: stripUndefinedDeep(diagnostics) } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.warn('Pending flashcard set marked as failed', { flashcardSetId, userId, error });
  await syncIndexSafely('failPendingFlashcardSet', () =>
    syncArtifactDirectoryIndex(userId, 'flashcard', flashcardSetId),
  );
}

// ─── Slide Deck ───────────────────────────────────────────────────────────────

export interface PendingSlideDeckParams {
  directoryId: string;
  documentId: string;
  documentIds?: string[];
  documentTitle: string;
  title: string;
  userId: string;
  documentColor?: string;
  documentColors?: string[];
}

export async function createPendingSlideDeck(params: PendingSlideDeckParams): Promise<string> {
  const ref = FirestorePaths.slideDecks(params.userId).doc();
  await ref.set({
    id: ref.id,
    userId: params.userId,
    documentId: params.documentId,
    ...(params.documentIds ? { documentIds: params.documentIds } : {}),
    documentTitle: params.documentTitle,
    title: params.title,
    slides: [],
    directoryId: params.directoryId,
    appliedRuleIds: [],
    ...(params.documentColor ? { documentColor: params.documentColor } : {}),
    ...(params.documentColors ? { documentColors: params.documentColors } : {}),
    generationStatus: 'pending' as GenerationStatus,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.info('Pending slide deck created', { slideDeckId: ref.id, userId: params.userId });
  await syncIndexSafely('createPendingSlideDeck', () =>
    syncArtifactDirectoryIndex(params.userId, 'slideDeck', ref.id),
  );
  return ref.id;
}

export async function completePendingSlideDeck(
  userId: string,
  slideDeckId: string,
  updates: {
    title: string;
    slides: object[];
    appliedRuleIds?: string[];
    generationModel?: string;
    generationModelUsage?: IGenerationModelUsage[];
  }
): Promise<void> {
  const ref = FirestorePaths.slideDeck(userId, slideDeckId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Pending slide deck ${slideDeckId} not found`);
  const data = snap.data() as { directoryId?: string };

  await ref.update({
    title: updates.title,
    slides: updates.slides,
    appliedRuleIds: updates.appliedRuleIds || [],
    ...(updates.generationModel ? { generationModel: updates.generationModel } : {}),
    ...(updates.generationModelUsage?.length
      ? { generationModelUsage: updates.generationModelUsage }
      : {}),
    generationStatus: 'completed' as GenerationStatus,
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (data.directoryId) {
    await FirestorePaths.directory(userId, data.directoryId).update({
      slideDeckCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  logger.info('Pending slide deck completed', { slideDeckId, userId });
  await syncIndexSafely('completePendingSlideDeck', () =>
    syncArtifactDirectoryIndex(userId, 'slideDeck', slideDeckId),
  );
}

export async function failPendingSlideDeck(userId: string, slideDeckId: string, error: string): Promise<void> {
  await FirestorePaths.slideDeck(userId, slideDeckId).update({
    generationStatus: 'failed' as GenerationStatus,
    generationError: error,
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.warn('Pending slide deck marked as failed', { slideDeckId, userId, error });
  await syncIndexSafely('failPendingSlideDeck', () =>
    syncArtifactDirectoryIndex(userId, 'slideDeck', slideDeckId),
  );
}

// ─── Diagram Quiz ─────────────────────────────────────────────────────────────

export interface PendingDiagramQuizParams {
  directoryId: string;
  documentId: string;
  documentIds?: string[];
  documentTitle: string;
  title: string;
  userId: string;
  followupRuleIds?: string[];
  documentColor?: string;
  documentColors?: string[];
}

export async function createPendingDiagramQuiz(params: PendingDiagramQuizParams): Promise<string> {
  const ref = FirestorePaths.diagramQuizzes(params.userId).doc();
  await ref.set({
    id: ref.id,
    userId: params.userId,
    documentId: params.documentId,
    ...(params.documentIds ? { documentIds: params.documentIds } : {}),
    documentTitle: params.documentTitle,
    title: params.title,
    questions: [],
    directoryId: params.directoryId,
    followupRuleIds: params.followupRuleIds || [],
    appliedRuleIds: [],
    ...(params.documentColor ? { documentColor: params.documentColor } : {}),
    ...(params.documentColors ? { documentColors: params.documentColors } : {}),
    generationStatus: 'pending' as GenerationStatus,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.info('Pending diagram quiz created', { diagramQuizId: ref.id, userId: params.userId });
  await syncIndexSafely('createPendingDiagramQuiz', () =>
    syncArtifactDirectoryIndex(params.userId, 'diagramQuiz', ref.id),
  );
  return ref.id;
}

export async function completePendingDiagramQuiz(
  userId: string,
  diagramQuizId: string,
  updates: {
    title: string;
    questions: object[];
    appliedRuleIds?: string[];
    followupRuleIds?: string[];
    generationAttempt?: number;
    generationModel?: string;
    generationModelUsage?: IGenerationModelUsage[];
    agentModel?: string;
    generationDiagnostics?: IArtifactAgentDiagnostics;
  }
): Promise<void> {
  const ref = FirestorePaths.diagramQuiz(userId, diagramQuizId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Pending diagram quiz ${diagramQuizId} not found`);
  const data = snap.data() as { directoryId?: string };

  await ref.update({
    title: updates.title,
    questions: updates.questions,
    appliedRuleIds: updates.appliedRuleIds || [],
    ...(updates.followupRuleIds !== undefined ? { followupRuleIds: updates.followupRuleIds } : {}),
    generationAttempt: updates.generationAttempt || 1,
    ...(updates.generationModel ? { generationModel: updates.generationModel } : {}),
    ...(updates.generationModelUsage?.length
      ? { generationModelUsage: updates.generationModelUsage }
      : {}),
    ...(updates.agentModel ? { agentModel: updates.agentModel } : {}),
    ...(updates.generationDiagnostics
      ? { generationDiagnostics: stripUndefinedDeep(updates.generationDiagnostics) }
      : {}),
    generationStatus: 'completed' as GenerationStatus,
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (data.directoryId) {
    await FirestorePaths.directory(userId, data.directoryId).update({
      diagramQuizCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  logger.info('Pending diagram quiz completed', { diagramQuizId, userId });
  await syncIndexSafely('completePendingDiagramQuiz', () =>
    syncArtifactDirectoryIndex(userId, 'diagramQuiz', diagramQuizId),
  );
}

export async function failPendingDiagramQuiz(
  userId: string,
  diagramQuizId: string,
  error: string,
  diagnostics?: IArtifactAgentDiagnostics
): Promise<void> {
  await FirestorePaths.diagramQuiz(userId, diagramQuizId).update({
    generationStatus: 'failed' as GenerationStatus,
    generationError: error,
    ...(diagnostics ? { generationDiagnostics: stripUndefinedDeep(diagnostics) } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.warn('Pending diagram quiz marked as failed', { diagramQuizId, userId, error });
  await syncIndexSafely('failPendingDiagramQuiz', () =>
    syncArtifactDirectoryIndex(userId, 'diagramQuiz', diagramQuizId),
  );
}

// ─── Sequence Quiz ────────────────────────────────────────────────────────────

export interface PendingSequenceQuizParams {
  directoryId: string;
  documentId: string;
  documentIds?: string[];
  documentTitle: string;
  title: string;
  userId: string;
  followupRuleIds?: string[];
  documentColor?: string;
  documentColors?: string[];
}

export async function createPendingSequenceQuiz(params: PendingSequenceQuizParams): Promise<string> {
  const ref = FirestorePaths.sequenceQuizzes(params.userId).doc();
  await ref.set({
    id: ref.id,
    userId: params.userId,
    documentId: params.documentId,
    ...(params.documentIds ? { documentIds: params.documentIds } : {}),
    documentTitle: params.documentTitle,
    title: params.title,
    questions: [],
    directoryId: params.directoryId,
    followupRuleIds: params.followupRuleIds || [],
    appliedRuleIds: [],
    ...(params.documentColor ? { documentColor: params.documentColor } : {}),
    ...(params.documentColors ? { documentColors: params.documentColors } : {}),
    generationStatus: 'pending' as GenerationStatus,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.info('Pending sequence quiz created', { sequenceQuizId: ref.id, userId: params.userId });
  await syncIndexSafely('createPendingSequenceQuiz', () =>
    syncArtifactDirectoryIndex(params.userId, 'sequenceQuiz', ref.id),
  );
  return ref.id;
}

export async function completePendingSequenceQuiz(
  userId: string,
  sequenceQuizId: string,
  updates: {
    title: string;
    questions: object[];
    appliedRuleIds?: string[];
    followupRuleIds?: string[];
    generationAttempt?: number;
    generationModel?: string;
    generationModelUsage?: IGenerationModelUsage[];
  }
): Promise<void> {
  const ref = FirestorePaths.sequenceQuiz(userId, sequenceQuizId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Pending sequence quiz ${sequenceQuizId} not found`);
  const data = snap.data() as { directoryId?: string };

  await ref.update({
    title: updates.title,
    questions: updates.questions,
    appliedRuleIds: updates.appliedRuleIds || [],
    ...(updates.followupRuleIds !== undefined ? { followupRuleIds: updates.followupRuleIds } : {}),
    generationAttempt: updates.generationAttempt || 1,
    ...(updates.generationModel ? { generationModel: updates.generationModel } : {}),
    ...(updates.generationModelUsage?.length
      ? { generationModelUsage: updates.generationModelUsage }
      : {}),
    generationStatus: 'completed' as GenerationStatus,
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (data.directoryId) {
    await FirestorePaths.directory(userId, data.directoryId).update({
      sequenceQuizCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  logger.info('Pending sequence quiz completed', { sequenceQuizId, userId });
  await syncIndexSafely('completePendingSequenceQuiz', () =>
    syncArtifactDirectoryIndex(userId, 'sequenceQuiz', sequenceQuizId),
  );
}

export async function failPendingSequenceQuiz(userId: string, sequenceQuizId: string, error: string): Promise<void> {
  await FirestorePaths.sequenceQuiz(userId, sequenceQuizId).update({
    generationStatus: 'failed' as GenerationStatus,
    generationError: error,
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.warn('Pending sequence quiz marked as failed', { sequenceQuizId, userId, error });
  await syncIndexSafely('failPendingSequenceQuiz', () =>
    syncArtifactDirectoryIndex(userId, 'sequenceQuiz', sequenceQuizId),
  );
}

// ─── Subject World ────────────────────────────────────────────────────────────

export interface PendingSubjectWorldParams {
  directoryId: string;
  documentId: string;
  documentIds?: string[];
  documentTitle: string;
  title: string;
  userId: string;
  followupRuleIds?: string[];
  documentColor?: string;
  documentColors?: string[];
}

export async function createPendingSubjectWorld(params: PendingSubjectWorldParams): Promise<string> {
  const ref = FirestorePaths.subjectWorlds(params.userId).doc();
  await ref.set({
    id: ref.id,
    userId: params.userId,
    documentId: params.documentId,
    ...(params.documentIds ? { documentIds: params.documentIds } : {}),
    documentTitle: params.documentTitle,
    title: params.title,
    worldSpec: null,
    directoryId: params.directoryId,
    followupRuleIds: params.followupRuleIds || [],
    appliedRuleIds: [],
    ...(params.documentColor ? { documentColor: params.documentColor } : {}),
    ...(params.documentColors ? { documentColors: params.documentColors } : {}),
    generationStatus: 'pending' as GenerationStatus,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.info('Pending subject world created', { subjectWorldId: ref.id, userId: params.userId });
  await syncIndexSafely('createPendingSubjectWorld', () =>
    syncArtifactDirectoryIndex(params.userId, 'subjectWorld', ref.id),
  );
  return ref.id;
}

export async function completePendingSubjectWorld(
  userId: string,
  subjectWorldId: string,
  updates: {
    title: string;
    worldSpec: object;
    appliedRuleIds?: string[];
    followupRuleIds?: string[];
    generationAttempt?: number;
    generationModel?: string;
    generationModelUsage?: IGenerationModelUsage[];
  }
): Promise<void> {
  const ref = FirestorePaths.subjectWorld(userId, subjectWorldId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Pending subject world ${subjectWorldId} not found`);
  const data = snap.data() as { directoryId?: string };

  await ref.update({
    title: updates.title,
    worldSpec: updates.worldSpec,
    appliedRuleIds: updates.appliedRuleIds || [],
    ...(updates.followupRuleIds !== undefined ? { followupRuleIds: updates.followupRuleIds } : {}),
    generationAttempt: updates.generationAttempt || 1,
    ...(updates.generationModel ? { generationModel: updates.generationModel } : {}),
    ...(updates.generationModelUsage?.length
      ? { generationModelUsage: updates.generationModelUsage }
      : {}),
    generationStatus: 'completed' as GenerationStatus,
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (data.directoryId) {
    await FirestorePaths.directory(userId, data.directoryId).update({
      subjectWorldCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  logger.info('Pending subject world completed', { subjectWorldId, userId });
  await syncIndexSafely('completePendingSubjectWorld', () =>
    syncArtifactDirectoryIndex(userId, 'subjectWorld', subjectWorldId),
  );
}

export async function failPendingSubjectWorld(userId: string, subjectWorldId: string, error: string): Promise<void> {
  await FirestorePaths.subjectWorld(userId, subjectWorldId).update({
    generationStatus: 'failed' as GenerationStatus,
    generationError: error,
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.warn('Pending subject world marked as failed', { subjectWorldId, userId, error });
  await syncIndexSafely('failPendingSubjectWorld', () =>
    syncArtifactDirectoryIndex(userId, 'subjectWorld', subjectWorldId),
  );
}
