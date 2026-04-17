import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { z } from 'zod';

/** Redact identifier for info-level logs to reduce privacy/compliance risk. */
const redactId = (id: string): string => createHash('sha256').update(id).digest('hex').slice(0, 8);
import {
  Flashcard,
  FlashcardSet,
  RuleApplicability,
} from '@shared-types';
import { DocumentCrudService } from '../services/document-crud';
import { directoryService } from '../services/directory';
import { resolveGenerationRulesForPrompt } from '../services/rule-resolution';
import { DocumentService } from '../services/document-storage';
import { GeminiService } from '../services/gemini/gemini';
import { validateAuth } from '../lib/auth';
import { FirestorePaths } from '../lib/firestore-paths';
import { promptBuilder } from '../services/promptBuilder';

// Define secrets
const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Zod schemas for request payload validation
const generateFlashcardsRequestSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1, 'At least one documentId is required').max(5, 'Maximum 5 documents allowed'),
  directoryId: z.string().optional(),
  title: z.string().max(100).nullish(),
  additionalPrompt: z.string().max(500).nullish(),
  ruleIds: z.array(z.string()).optional(),
  additionalRuleIds: z.array(z.string()).optional(),
});

const flashcardSetIdRequestSchema = z.object({
  flashcardSetId: z.string().min(1, 'flashcardSetId is required'),
});

const flashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  explanation: z.string().optional(),
});

const updateFlashcardSetRequestSchema = z.object({
  flashcardSetId: z.string().min(1, 'flashcardSetId is required'),
  title: z.string().optional(),
  flashcards: z.array(flashcardSchema).optional(),
});

const getUserFlashcardSetsRequestSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
}).optional();

// Helper to restrict to emulator-only (for debug endpoints)
const requireEmulator = (): void => {
  if (process.env.FUNCTIONS_EMULATOR !== 'true') {
    throw new HttpsError(
      'failed-precondition',
      'This endpoint is only available when running in the Firebase emulator.'
    );
  }
};

// Helper function that contains the core generation logic
async function generateFlashcardsFromContent(content: string, title: string, rules?: string): Promise<Pick<FlashcardSet, 'title' | 'flashcards'>> {
  const generatedFlashcards = await GeminiService.generateFlashcards(content, rules);

  const flashcardsWithIds: Flashcard[] = generatedFlashcards.map((card) => ({
    ...card,
    id: admin.firestore().collection('tmp').doc().id, // Generate a unique random ID
  }));

  return {
    title: `Flashcards for "${title}"`,
    flashcards: flashcardsWithIds,
  };
}

/**
 * Generates a new set of flashcards from a document.
 */
export const generateFlashcards = onCall({ region: 'asia-east1', cors: true, secrets: [geminiApiKey] }, async (request) => {
  try {
    const userId = validateAuth(request);
    const parseResult = generateFlashcardsRequestSchema.safeParse(request.data);
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message ?? 'Invalid request payload.';
      throw new HttpsError('invalid-argument', msg);
    }
    const { documentIds, directoryId: requestDirectoryId, title: customTitle, additionalPrompt, ruleIds, additionalRuleIds } = parseResult.data;

    const u = redactId(userId);

    logger.info(`[generateFlashcards] STEP 1: Function started.`, {
      userIdHash: u,
      documentCount: documentIds.length,
      hasCustomTitle: !!customTitle,
      hasAdditionalPrompt: !!additionalPrompt,
      ruleCount: ruleIds?.length || 0,
    });

    // Fetch all documents and their content in parallel
    // Each fetch is wrapped in try-catch to preserve error context before Promise.all short-circuits
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

    // Build combined content
    const combinedContent = documentDataList
      .map((d) => d.content)
      .join('\n\n---\n\n');
    const combinedTitle = documentDataList.map((d) => d.title).join(' + ');

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

    // Resolve rules to inject into the prompt
    let injectedRules: string | undefined;
    let appliedRuleIdsForSave: string[] = [];
    if (ruleIds?.length) {
      logger.info(`[generateFlashcards] STEP 2.5: Injecting rules into prompt.`, { userIdHash: u, ruleCount: ruleIds.length });
      injectedRules = await promptBuilder.injectRules(additionalPrompt || '', ruleIds, userId);
      appliedRuleIdsForSave = ruleIds;
    } else {
      const { text: rulesText, ruleIds: resolvedAppliedIds } = await resolveGenerationRulesForPrompt(
        userId,
        resolvedDirectoryId,
        RuleApplicability.FLASHCARD,
        additionalRuleIds
      );
      appliedRuleIdsForSave = resolvedAppliedIds;
      const base = additionalPrompt?.trim() ? `Additional instructions: ${additionalPrompt}` : '';
      if (rulesText && base) {
        injectedRules = `${rulesText}\n\n${base}`;
      } else if (rulesText) {
        injectedRules = rulesText;
      } else if (base) {
        injectedRules = base;
      }
    }

    logger.info(`[generateFlashcards] STEP 3: Calling generateFlashcardsFromContent (GeminiService).`, { userIdHash: u });
    const generatedData = await generateFlashcardsFromContent(combinedContent, combinedTitle, injectedRules);
    logger.info(`[generateFlashcards] STEP 4: Flashcard generation complete. Flashcards created: ${generatedData.flashcards.length}`, { userIdHash: u });

    // Apply custom title or auto-name
    if (customTitle?.trim()) {
      generatedData.title = customTitle.trim();
    } else if (documentIds.length === 1) {
      generatedData.title = `Flashcards for "${documentDataList[0].title}"`;
    } else {
      generatedData.title = `Flashcards for "${documentDataList[0].title}" + ${documentIds.length - 1} more`;
    }

    const primaryDocumentId = documentIds[0];
    const newFlashcardSetData = {
      ...generatedData,
      userId,
      documentId: primaryDocumentId,
      directoryId: resolvedDirectoryId,
      ...(documentIds.length > 1 ? { documentIds } : {}),
      documentTitle: documentDataList[0].title,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      appliedRuleIds: appliedRuleIdsForSave,
    };

    logger.info(`[generateFlashcards] STEP 5: Adding new flashcard set to Firestore.`, { userIdHash: u });
    const db = admin.firestore();
    const newRef = FirestorePaths.flashcardSets(userId).doc();
    await db.runTransaction(async (transaction) => {
      transaction.set(newRef, newFlashcardSetData);
      transaction.update(FirestorePaths.directory(userId, resolvedDirectoryId), {
        flashcardSetCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    const docRef = newRef;
    logger.info(`[generateFlashcards] STEP 6: Firestore add complete. New document ID: ${redactId(docRef.id)}`, { userIdHash: u });

    return { success: true, data: { flashcardSetId: docRef.id } };

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

    return { success: true };
  } catch(error) {
    logger.error(`Error updating flashcard set ${request.data?.flashcardSetId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Could not update flashcard set.');
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

    const docRef = FirestorePaths.flashcardSets(userId).doc(flashcardSetId);
    const db = admin.firestore();
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists) {
        throw new HttpsError('not-found', 'No flashcard set found with that ID.');
      }
      const existing = snap.data() as FlashcardSet;
      transaction.delete(docRef);
      if (existing.directoryId) {
        transaction.update(FirestorePaths.directory(userId, existing.directoryId), {
          flashcardSetCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return { success: true };
  } catch(error) {
    logger.error(`Error deleting flashcard set ${request.data?.flashcardSetId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Could not delete flashcard set.');
  }
});

/**
 * Debug endpoint: returns the resolved bucket name and lists files in the emulator bucket.
 * Useful for diagnosing Storage emulator bucket name mismatches.
 * Restricted to authenticated users and emulator-only usage.
 */
export const debugStorageBucket = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  try {
    validateAuth(request);
    requireEmulator();

    const result = await DocumentService.debugBucket();
    logger.info('debugStorageBucket result', result);
    return result;
  } catch (error) {
    logger.error('debugStorageBucket error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', String(error));
  }
});
