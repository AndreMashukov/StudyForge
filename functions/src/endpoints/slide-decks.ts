import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { z } from 'zod';

import { SlideDeck, getDocumentFallbackColor } from '@shared-types';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { directoryService } from '@study-forge/backend-directories/directory';
import {
  createPendingSlideDeck,
  failPendingSlideDeck,
} from '@study-forge/backend-artifacts/artifact-generation-records';
import { enqueueGenerationJob } from '@study-forge/backend-generation/generation-enqueue';
import { buildStartGenerationPayload } from '@study-forge/backend-core/lib/start-generation-response';
import { validateVerifiedAuth } from '@study-forge/backend-core/lib/auth';
import {
  enforceCallableSlideDeckGenerationLimits,
  refundSlideDeckGenerationReservationsSafe,
} from '@study-forge/backend-generation/generation-limits';
import { deleteSlideDeckForUser } from '@study-forge/backend-artifacts/artifact-delete';

const redactId = (id: string): string =>
  createHash('sha256').update(id).digest('hex').slice(0, 8);

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

const generateSlideDeckRequestSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1, 'At least one documentId is required').max(5, 'Maximum 5 documents allowed'),
  directoryId: z.string().optional(),
  title: z.string().max(100).nullish(),
  additionalPrompt: z.string().max(20000).nullish(),
  // Accept null/undefined elements gracefully and strip them out
  ruleIds: z.array(z.string().nullable().optional()).optional()
    .transform(arr => (arr ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0)),
  additionalRuleIds: z.array(z.string()).optional(),
  ruleResolutionMode: z.enum(['inherit', 'inherit-plus-explicit', 'explicit-only']).optional(),
});

const slideDeckIdRequestSchema = z.object({
  slideDeckId: z.string().min(1, 'slideDeckId is required'),
});

/**
 * Generates a slide deck from a document using Gemini AI.
 */
export const generateSlideDeck = onCall(
  { region: 'asia-east1', cors: true, secrets: [geminiApiKey, llmSettingsEncryptionKey], timeoutSeconds: 60, memory: '512MiB' },
  async (request) => {
    let usageReservationId: string | undefined;
    let dailySlideDeckReservationId: string | undefined;

    try {
      const userId = await validateVerifiedAuth(request);
      const parseResult = generateSlideDeckRequestSchema.safeParse(request.data);
      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        const msg = firstIssue?.message ?? 'Invalid request payload.';
        logger.warn('[generateSlideDeck] Validation failed', {
          issues: parseResult.error.issues.map(i => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        });
        throw new HttpsError('invalid-argument', msg);
      }
      const { documentIds, directoryId: requestDirectoryId, title: customTitle, additionalPrompt, ruleIds } = parseResult.data;

      const u = redactId(userId);

      // Validate documents and directory before reserving quota.
      const documentDataList = await Promise.all(
        documentIds.map(async (docId, index) => {
          try {
            const doc = await DocumentCrudService.getDocumentWithContent(userId, docId);
            if (!doc || !doc.content) {
              throw new HttpsError(
                'not-found',
                `Document at index ${index} (id: ${docId}) does not exist or has no content.`,
              );
            }
            return doc;
          } catch (err) {
            if (err instanceof HttpsError) throw err;
            throw new HttpsError(
              'not-found',
              `Failed to fetch document at index ${index} (id: ${docId}).`,
            );
          }
        }),
      );

      const resolvedDirectoryId = requestDirectoryId ?? documentDataList[0]?.directoryId;
      if (!resolvedDirectoryId) {
        throw new HttpsError(
          'invalid-argument',
          'directoryId is required, or documents must belong to a directory',
        );
      }
      await directoryService.validateDirectoryId(userId, resolvedDirectoryId);
      for (const d of documentDataList) {
        if (!d.directoryId || d.directoryId !== resolvedDirectoryId) {
          throw new HttpsError(
            'invalid-argument',
            'All documents must belong to the same directory',
          );
        }
      }

      const slideDeckReservations = await enforceCallableSlideDeckGenerationLimits(userId);
      usageReservationId = slideDeckReservations.usageReservation.id;
      dailySlideDeckReservationId = slideDeckReservations.dailySlideDeckReservation.id;

      logger.info('[generateSlideDeck] STEP 1: Function started.', {
        userIdHash: u,
        documentCount: documentIds.length,
        hasCustomTitle: !!customTitle,
        hasAdditionalPrompt: !!additionalPrompt,
        ruleCount: ruleIds?.length || 0,
      });

      logger.info('[generateSlideDeck] STEP 2: Documents retrieved.', { userIdHash: u });

      const pendingTitle =
        customTitle?.trim() ||
        (documentIds.length === 1
          ? `Slides for "${documentDataList[0].title}"`
          : `Slides for "${documentDataList[0].title}" + ${documentIds.length - 1} more`);

      const pendingSlideDeckId = await createPendingSlideDeck({
        directoryId: resolvedDirectoryId,
        userId,
        documentId: documentIds[0],
        documentIds: documentIds.length > 1 ? documentIds : undefined,
        documentTitle: documentDataList[0].title,
        title: pendingTitle,
        documentColor:
          documentDataList[0].color ?? getDocumentFallbackColor(documentDataList[0].id),
        documentColors:
          documentDataList.length > 1
            ? documentDataList.map((d) => d.color ?? getDocumentFallbackColor(d.id))
            : undefined,
      });

      try {
        await enqueueGenerationJob({
          userId,
          directoryId: resolvedDirectoryId,
          recordId: pendingSlideDeckId,
          kind: 'slideDeck',
          payload: parseResult.data,
          usageReservationId,
          dailySlideDeckReservationId,
        });

        logger.info(`[generateSlideDeck] Queued slide deck generation`, { userIdHash: u });
        return {
          success: true,
          data: buildStartGenerationPayload('slideDeck', pendingSlideDeckId, resolvedDirectoryId, {
            slideDeckId: pendingSlideDeckId,
          }),
        };
      } catch (innerError) {
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        await failPendingSlideDeck(userId, pendingSlideDeckId, msg).catch(() => {
          /* best-effort */
        });
        await refundSlideDeckGenerationReservationsSafe({
          userId,
          usageReservationId,
          dailySlideDeckReservationId,
        });
        usageReservationId = undefined;
        dailySlideDeckReservationId = undefined;
        throw innerError;
      }
    } catch (error) {
      if (usageReservationId || dailySlideDeckReservationId) {
        const userId = request.auth?.uid;
        if (userId) {
          await refundSlideDeckGenerationReservationsSafe({
            userId,
            usageReservationId,
            dailySlideDeckReservationId,
          });
        }
      }
      logger.error('Error in generateSlideDeck:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'An unexpected error occurred while generating the slide deck.');
    }
  }
);

/**
 * Gets a single slide deck.
 */
export const getSlideDeck = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  try {
    const userId = await validateVerifiedAuth(request);
    const parseResult = slideDeckIdRequestSchema.safeParse(request.data);
    if (!parseResult.success) {
      throw new HttpsError('invalid-argument', parseResult.error.issues[0]?.message ?? 'Invalid request.');
    }
    const { slideDeckId } = parseResult.data;

    const doc = await admin.firestore()
      .collection('users').doc(userId).collection('slideDecks').doc(slideDeckId)
      .get();

    if (!doc.exists) {
      throw new HttpsError('not-found', 'No slide deck found with that ID.');
    }

    const slideDeck = { ...doc.data(), id: doc.id } as SlideDeck;

    // Resolve storage paths to signed download URLs
    if (slideDeck.slides) {
      const bucket = admin.storage().bucket();
      const isEmulator = !!process.env.FUNCTIONS_EMULATOR || !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;
      for (const slide of slideDeck.slides) {
        if (slide.imageStoragePath) {
          try {
            const encodedPath = encodeURIComponent(slide.imageStoragePath);
            if (isEmulator) {
              // Storage emulator does not support signed URLs — use direct download URL
              slide.imageUrl = `http://127.0.0.1:9199/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;
            } else if (slide.imageDownloadToken) {
              // Use the Firebase Storage download token stored at upload time.
              // This avoids the IAM Service Account Credentials API permission required by getSignedUrl.
              slide.imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${slide.imageDownloadToken}`;
            } else {
              // Legacy decks without a stored token — fall back to signed URL.
              const [url] = await bucket.file(slide.imageStoragePath).getSignedUrl({
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000,
              });
              slide.imageUrl = url;
            }
          } catch (err) {
            logger.warn(`Failed to resolve image URL for ${slide.imageStoragePath}:`, err);
          }
        }
      }
    }

    return { success: true, data: slideDeck };
  } catch (error) {
    logger.error('Error in getSlideDeck:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'An unexpected error occurred while fetching the slide deck.');
  }
});

/**
 * Gets all slide decks for the authenticated user.
 */
export const getUserSlideDecks = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  try {
    const userId = await validateVerifiedAuth(request);

    const snapshot = await admin.firestore()
      .collection('users').doc(userId).collection('slideDecks')
      .orderBy('createdAt', 'desc')
      .get();

    const slideDecks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    return { success: true, data: slideDecks };
  } catch (error) {
    logger.error('Error in getUserSlideDecks:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'An unexpected error occurred while fetching slide decks.');
  }
});

/**
 * Deletes a slide deck and its associated storage files.
 */
export const deleteSlideDeck = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  try {
    const userId = await validateVerifiedAuth(request);
    const parseResult = slideDeckIdRequestSchema.safeParse(request.data);
    if (!parseResult.success) {
      throw new HttpsError('invalid-argument', parseResult.error.issues[0]?.message ?? 'Invalid request.');
    }
    const { slideDeckId } = parseResult.data;

    await deleteSlideDeckForUser(userId, slideDeckId);

    return { success: true };
  } catch (error) {
    logger.error('Error in deleteSlideDeck:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'An unexpected error occurred while deleting the slide deck.');
  }
});
