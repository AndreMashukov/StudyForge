import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { z } from 'zod';

/** Redact identifier for info-level logs to reduce privacy/compliance risk. */
const redactId = (id: string): string => createHash('sha256').update(id).digest('hex').slice(0, 8);
import {
  FlashcardSet,
  getDocumentFallbackColor,
} from '@shared-types';
import { DocumentCrudService } from '../services/document-crud';
import { directoryService } from '../services/directory';
import {
  createPendingFlashcardSet,
  failPendingFlashcardSet,
} from '../services/artifact-generation-records';
import { GenerationJobPayloadStorage } from '../services/generation-job-payload-storage';
import { GenerationJobsService } from '../services/generation-jobs';
import { enqueueGenerationJobTask } from '../services/generation-task-queue';
import type { ArtifactAgentJobPayload } from '../services/artifact-agent';
import { buildStartGenerationPayload } from '../lib/start-generation-response';
import { validateAuth } from '../lib/auth';
import { enforceCallableGenerationRateLimit } from '../lib/generation-rate-limit';
import { FirestorePaths } from '../lib/firestore-paths';
import {
  syncArtifactDirectoryIndex,
  syncIndexSafely,
} from '../services/directory-item-index';
import { isRuleResolutionMode } from '../services/rule-resolution';
import {
  isRecordLearnedVocabularyError,
  recordLearnedVocabularyFromFlashcard,
  type IFlashcardJobPayload,
} from '../services/flashcards';

// Define secrets
const geminiApiKey = defineSecret('GEMINI_API_KEY');
const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

// Zod schemas for request payload validation
const generateFlashcardsRequestSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1, 'At least one documentId is required').max(5, 'Maximum 5 documents allowed'),
  directoryId: z.string().optional(),
  title: z.string().max(100).nullish(),
  additionalPrompt: z.string().max(20000).nullish(),
  ruleIds: z.array(z.string()).optional(),
  descriptionRuleIds: z.array(z.string()).optional(),
  additionalRuleIds: z.array(z.string()).optional(),
  ruleResolutionMode: z.enum(['inherit', 'inherit-plus-explicit', 'explicit-only']).optional(),
});

const flashcardSetIdRequestSchema = z.object({
  flashcardSetId: z.string().min(1, 'flashcardSetId is required'),
});

const flashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  explanation: z.string().optional(),
  description: z.string().optional(),
  frontHtml: z.string().optional(),
  backHtml: z.string().optional(),
  descriptionHtml: z.string().optional(),
});

const updateFlashcardSetRequestSchema = z.object({
  flashcardSetId: z.string().min(1, 'flashcardSetId is required'),
  title: z.string().optional(),
  flashcards: z.array(flashcardSchema).optional(),
});

const getUserFlashcardSetsRequestSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
}).optional();

const recordLearnedVocabularyRequestSchema = z.object({
  flashcardSetId: z.string().min(1, 'flashcardSetId is required'),
  flashcardId: z.string().min(1, 'flashcardId is required'),
  term: z.string().min(1).max(200).optional(),
});

/**
 * Generates a new set of flashcards from a document.
 */
export const generateFlashcards = onCall({ region: 'asia-east1', cors: true, secrets: [geminiApiKey, llmSettingsEncryptionKey], timeoutSeconds: 60 }, async (request) => {
  try {
    const userId = validateAuth(request);
    const parseResult = generateFlashcardsRequestSchema.safeParse(request.data);
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message ?? 'Invalid request payload.';
      throw new HttpsError('invalid-argument', msg);
    }
    const {
      documentIds,
      directoryId: requestDirectoryId,
      title: customTitle,
      additionalPrompt,
      ruleIds,
      descriptionRuleIds,
      additionalRuleIds,
      ruleResolutionMode,
    } = parseResult.data;

    await enforceCallableGenerationRateLimit(userId, 'flashcards');

    const u = redactId(userId);

    logger.info(`[generateFlashcards] STEP 1: Function started.`, {
      userIdHash: u,
      documentCount: documentIds.length,
      hasCustomTitle: !!customTitle,
      hasAdditionalPrompt: !!additionalPrompt,
      ruleCount: ruleIds?.length || 0,
    });

    const documentDataList = await Promise.all(
      documentIds.map(async (docId, index) => {
        try {
          const doc = await DocumentCrudService.getDocumentWithContent(userId, docId);
          if (!doc || !doc.content) {
            throw new HttpsError('not-found', `Document at index ${index} (id: ${docId}) does not exist or has no content.`);
          }
          return doc;
        } catch (err) {
          if (err instanceof HttpsError) throw err;
          throw new HttpsError('not-found', `Failed to fetch document at index ${index} (id: ${docId}).`);
        }
      })
    );

    logger.info(`[generateFlashcards] STEP 2: Documents retrieved.`, { userIdHash: u, documentCount: documentDataList.length });

    const resolvedDirectoryId = requestDirectoryId ?? documentDataList[0]?.directoryId;
    if (!resolvedDirectoryId) {
      throw new HttpsError('invalid-argument', 'directoryId is required, or documents must belong to a directory');
    }
    await directoryService.validateDirectoryId(userId, resolvedDirectoryId);
    for (const d of documentDataList) {
      if (!d.directoryId || d.directoryId !== resolvedDirectoryId) {
        throw new HttpsError('invalid-argument', 'All documents must belong to the same directory');
      }
    }

    const pendingTitle = customTitle?.trim()
      || (documentIds.length === 1
        ? `Flashcards for "${documentDataList[0].title}"`
        : `Flashcards for "${documentDataList[0].title}" + ${documentIds.length - 1} more`);

    const pendingFlashcardSetId = await createPendingFlashcardSet({
      directoryId: resolvedDirectoryId,
      userId,
      documentId: documentIds[0],
      documentIds: documentIds.length > 1 ? documentIds : undefined,
      documentTitle: documentDataList[0].title,
      title: pendingTitle,
      documentColor: documentDataList[0].color ?? getDocumentFallbackColor(documentDataList[0].id),
      documentColors: documentDataList.length > 1
        ? documentDataList.map(d => d.color ?? getDocumentFallbackColor(d.id))
        : undefined,
    });

    try {
      const mode = isRuleResolutionMode(ruleResolutionMode)
        ? ruleResolutionMode
        : (ruleIds?.length || descriptionRuleIds?.length
          ? 'explicit-only'
          : 'inherit-plus-explicit');
      const selectedRuleIds = ruleIds?.length ? ruleIds : additionalRuleIds;

      const jobId = GenerationJobsService.newJobId(userId);
      const payload: ArtifactAgentJobPayload<IFlashcardJobPayload> = {
        artifactKind: 'flashcards',
        documentIds,
        directoryId: resolvedDirectoryId,
        recordId: pendingFlashcardSetId,
        title: pendingTitle,
        additionalPrompt: additionalPrompt ?? undefined,
        ruleIds: selectedRuleIds,
        additionalRuleIds,
        ruleResolutionMode: mode,
        artifactPayload: {
          descriptionRuleIds,
        },
      };

      const payloadStoragePath = await GenerationJobPayloadStorage.saveJson(userId, jobId, payload);
      await GenerationJobsService.createJob({
        jobId,
        kind: 'artifactAgent',
        userId,
        directoryId: resolvedDirectoryId,
        recordId: pendingFlashcardSetId,
        payloadStoragePath,
        artifactKind: 'flashcards',
      });
      await enqueueGenerationJobTask({ userId, jobId });

      logger.info(`[generateFlashcards] Queued flashcard generation`, { userIdHash: u, jobId });
      return {
        success: true,
        data: buildStartGenerationPayload('flashcardSet', pendingFlashcardSetId, resolvedDirectoryId, {
          flashcardSetId: pendingFlashcardSetId,
        }),
      };
    } catch (innerError) {
      const msg = innerError instanceof Error ? innerError.message : String(innerError);
      await failPendingFlashcardSet(userId, pendingFlashcardSetId, msg).catch(() => {/* best-effort */});
      throw innerError;
    }

  } catch (error) {
    logger.error('Error in generateFlashcards:', error);
    if (error instanceof HttpsError) {
        throw error;
    }
    throw new HttpsError('internal', 'An unexpected error occurred while generating flashcards.');
  }
});

/**
 * Gets a single flashcard set.
 */
export const getFlashcardSet = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  try {
    const userId = validateAuth(request);
    const parseResult = flashcardSetIdRequestSchema.safeParse(request.data);
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message ?? 'Invalid request payload.';
      throw new HttpsError('invalid-argument', msg);
    }
    const { flashcardSetId } = parseResult.data;

    const doc = await admin.firestore().collection('users').doc(userId).collection('flashcardSets').doc(flashcardSetId).get();

    if (!doc.exists) {
      throw new HttpsError('not-found', 'No flashcard set found with that ID.');
    }
    const flashcardSet = { ...doc.data(), id: doc.id } as FlashcardSet;
    return { success: true, data: flashcardSet };
  } catch(error) {
    logger.error(`Error fetching flashcard set ${request.data?.flashcardSetId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Could not fetch flashcard set.');
  }
});

/**
 * Lists all flashcard sets for the authenticated user.
 */
export const getUserFlashcardSets = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  try {
    const userId = validateAuth(request);
    const parseResult = getUserFlashcardSetsRequestSchema.safeParse(request.data ?? {});
    const limit = Math.min(parseResult.success ? (parseResult.data?.limit ?? 50) : 50, 100);

    const snapshot = await admin.firestore()
      .collection('users').doc(userId).collection('flashcardSets')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const flashcardSets: Partial<FlashcardSet>[] = [];
    snapshot.forEach(doc => {
      flashcardSets.push({ ...doc.data(), id: doc.id });
    });

    return { success: true, data: flashcardSets };
  } catch (error) {
    logger.error('Error listing user flashcard sets:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Could not list flashcard sets.');
  }
});

/**
 * Updates an existing flashcard set.
 */
export const updateFlashcardSet = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  try {
    const userId = validateAuth(request);
    const parseResult = updateFlashcardSetRequestSchema.safeParse(request.data);
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message ?? 'Invalid request payload.';
      throw new HttpsError('invalid-argument', msg);
    }
    const { flashcardSetId, title, flashcards } = parseResult.data;

    const docRef = admin.firestore().collection('users').doc(userId).collection('flashcardSets').doc(flashcardSetId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new HttpsError('not-found', 'No flashcard set found with that ID.');
    }

    const updateData: Record<string, unknown> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (title !== undefined) updateData.title = title;
    if (flashcards !== undefined) updateData.flashcards = flashcards;

    await docRef.update(updateData);

    await syncIndexSafely('updateFlashcardSet', () =>
      syncArtifactDirectoryIndex(userId, 'flashcard', flashcardSetId),
    );

    return { success: true };
  } catch(error) {
    logger.error(`Error updating flashcard set ${request.data?.flashcardSetId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Could not update flashcard set.');
  }
});


/**
 * Records a learned vocabulary item when a language-learning flashcard is marked learned.
 */
export const recordLearnedVocabulary = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  try {
    const userId = validateAuth(request);
    const parseResult = recordLearnedVocabularyRequestSchema.safeParse(request.data);
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message ?? 'Invalid request payload.';
      throw new HttpsError('invalid-argument', msg);
    }

    const { flashcardSetId, flashcardId, term } = parseResult.data;
    const result = await recordLearnedVocabularyFromFlashcard({
      userId,
      flashcardSetId,
      flashcardId,
      term,
    });

    return {
      success: true,
      data: {
        learnedVocabularyId: result.id,
        created: result.created,
      },
    };
  } catch (error) {
    logger.error('Error recording learned vocabulary:', error);
    if (error instanceof HttpsError) throw error;
    if (isRecordLearnedVocabularyError(error)) {
      throw new HttpsError(error.code, error.message);
    }
    throw new HttpsError('internal', 'Could not record learned vocabulary.');
  }
});

/**
 * Deletes a flashcard set.
 */
export const deleteFlashcardSet = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  try {
    const userId = validateAuth(request);
    const parseResult = flashcardSetIdRequestSchema.safeParse(request.data);
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message ?? 'Invalid request payload.';
      throw new HttpsError('invalid-argument', msg);
    }
    const { flashcardSetId } = parseResult.data;
    const { deleteFlashcardSetForUser } = await import('../services/artifact-delete.js');
    await deleteFlashcardSetForUser(userId, flashcardSetId);
    return { success: true };
  } catch(error) {
    logger.error(`Error deleting flashcard set ${request.data?.flashcardSetId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Could not delete flashcard set.');
  }
});
