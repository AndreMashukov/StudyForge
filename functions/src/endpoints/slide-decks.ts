import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';

import { Slide, SlideDeck, RuleApplicability } from '@shared-types';
import { DocumentCrudService } from '../services/document-crud';
import { directoryService } from '../services/directory';
import { resolveGenerationRulesForPrompt } from '../services/rule-resolution';
import { GeminiService } from '../services/gemini/gemini';
import { validateAuth } from '../lib/auth';
import { FirestorePaths } from '../lib/firestore-paths';
import { promptBuilder } from '../services/promptBuilder';

const redactId = (id: string): string =>
  createHash('sha256').update(id).digest('hex').slice(0, 8);

const geminiApiKey = defineSecret('GEMINI_API_KEY');

const generateSlideDeckRequestSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1, 'At least one documentId is required').max(5, 'Maximum 5 documents allowed'),
  directoryId: z.string().optional(),
  title: z.string().max(100).nullish(),
  additionalPrompt: z.string().max(500).nullish(),
  // Accept null/undefined elements gracefully and strip them out
  ruleIds: z.array(z.string().nullable().optional()).optional()
    .transform(arr => (arr ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0)),
  additionalRuleIds: z.array(z.string()).optional(),
});

const slideDeckIdRequestSchema = z.object({
  slideDeckId: z.string().min(1, 'slideDeckId is required'),
});

/**
 * Generates a slide deck from a document using Gemini AI.
 */
export const generateSlideDeck = onCall(
  { region: 'asia-east1', cors: true, secrets: [geminiApiKey], timeoutSeconds: 300, memory: '1GiB' },
  async (request) => {
    try {
      const userId = validateAuth(request);
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
      const { documentIds, directoryId: requestDirectoryId, title: customTitle, additionalPrompt, ruleIds, additionalRuleIds } = parseResult.data;

      const u = redactId(userId);
      const uploadedPaths: string[] = [];

      logger.info('[generateSlideDeck] STEP 1: Function started.', {
        userIdHash: u,
        documentCount: documentIds.length,
        hasCustomTitle: !!customTitle,
        hasAdditionalPrompt: !!additionalPrompt,
        ruleCount: ruleIds?.length || 0,
      });

      try {
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

        logger.info('[generateSlideDeck] STEP 2: Documents retrieved.', { userIdHash: u });

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

        // Inject rules if provided
        let injectedRules: string | undefined;
        let appliedRuleIdsForSave: string[] = [];
        if (ruleIds?.length) {
          logger.info('[generateSlideDeck] STEP 2.5: Injecting rules.', { ruleCount: ruleIds.length });
          injectedRules = await promptBuilder.injectRules(additionalPrompt || '', ruleIds, userId);
          appliedRuleIdsForSave = ruleIds;
        } else {
          const { text: rulesText, ruleIds: resolvedAppliedIds } = await resolveGenerationRulesForPrompt(
            userId,
            resolvedDirectoryId,
            RuleApplicability.SLIDE_DECK,
            additionalRuleIds
          );
          appliedRuleIdsForSave = resolvedAppliedIds;
          const base = additionalPrompt?.trim() || '';
          if (rulesText && base) {
            injectedRules = `${rulesText}\n\n${base}`;
          } else if (rulesText) {
            injectedRules = rulesText;
          } else if (base) {
            injectedRules = base;
          }
        }

        // Step 3: Generate slide outline
        logger.info('[generateSlideDeck] STEP 3: Generating slide outline.', { userIdHash: u });
        const slideOutline = await GeminiService.generateSlideDeckOutline(combinedContent, additionalPrompt || undefined, injectedRules);
        logger.info(`[generateSlideDeck] STEP 4: Outline generated. Slides: ${slideOutline.length}`, { userIdHash: u });

        // Step 5: Generate images with two-phase approach + bounded concurrency (3 at a time)
        // Phase 1 (per slide): Gemini text model builds a detailed image brief from rules + content
        // Phase 2 (per slide): The brief is passed to the image model for rendering
        const CONCURRENCY = 3;
        const slides: Slide[] = slideOutline.map((outline) => ({
          id: admin.firestore().collection('tmp').doc().id,
          title: outline.title,
          content: outline.content,
          speakerNotes: outline.speakerNotes,
        }));

        for (let batch = 0; batch < slides.length; batch += CONCURRENCY) {
          const chunk = slides.slice(batch, batch + CONCURRENCY);
          const chunkIndices = chunk.map((_, ci) => batch + ci);

          logger.info(`[generateSlideDeck] STEP 5: Generating images for slides ${chunkIndices.join(',')}`, { userIdHash: u });

          await Promise.all(chunk.map(async (slide, ci) => {
            const i = batch + ci;

            // Phase 1: Generate detailed image brief using Gemini text model
            const brief = await GeminiService.generateSlideImageBrief(slide.title, slide.content, injectedRules);

            // Phase 2: Generate the actual image from the brief (or fall back to direct prompt)
            let imageBase64: string | null = null;
            if (brief) {
              const { SlideDeckPromptBuilder } = await import('../services/gemini/prompt-builder/slide-deck');
              const imagePrompt = SlideDeckPromptBuilder.buildSlideImageFromBriefPrompt(brief);
              imageBase64 = await GeminiService.generateSlideImageFromPrompt(imagePrompt);
            }
            if (!imageBase64) {
              // Fallback: direct image generation without brief
              imageBase64 = await GeminiService.generateSlideImage(slide.title, slide.content, injectedRules);
            }

            if (imageBase64) {
              const storagePath = `users/${userId}/slideDecks/${slide.id}/slide-${i}.png`;
              const downloadToken = randomUUID();
              const file = admin.storage().bucket().file(storagePath);
              await file.save(Buffer.from(imageBase64, 'base64'), {
                metadata: {
                  contentType: 'image/png',
                  metadata: { firebaseStorageDownloadTokens: downloadToken },
                },
                resumable: false,
              });
              slide.imageStoragePath = storagePath;
              slide.imageDownloadToken = downloadToken;
              uploadedPaths.push(storagePath);
            }
          }));
        }

        // Step 6: Save to Firestore
        let deckTitle: string;
        if (customTitle?.trim()) {
          deckTitle = customTitle.trim();
        } else if (documentIds.length === 1) {
          deckTitle = `Slides for "${documentDataList[0].title}"`;
        } else {
          deckTitle = `Slides for "${documentDataList[0].title}" + ${documentIds.length - 1} more`;
        }
        const primaryDocumentId = documentIds[0];
        const newSlideDeckData = {
          title: deckTitle,
          slides,
          userId,
          documentId: primaryDocumentId,
          directoryId: resolvedDirectoryId,
          ...(documentIds.length > 1 ? { documentIds } : {}),
          documentTitle: documentDataList[0].title,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          appliedRuleIds: appliedRuleIdsForSave,
        };

        logger.info('[generateSlideDeck] STEP 6: Saving to Firestore.', { userIdHash: u });
        const db = admin.firestore();
        const newDeckRef = FirestorePaths.slideDecks(userId).doc();
        await db.runTransaction(async (transaction) => {
          transaction.set(newDeckRef, newSlideDeckData);
          transaction.update(FirestorePaths.directory(userId, resolvedDirectoryId), {
            slideDeckCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        const docRef = newDeckRef;

        logger.info(`[generateSlideDeck] STEP 7: Complete. Deck ID: ${redactId(docRef.id)}`, { userIdHash: u });

        return { success: true, data: { slideDeckId: docRef.id } };
      } catch (innerError) {
        // Cleanup orphaned storage files on failure
        if (uploadedPaths.length > 0) {
          logger.warn(`[generateSlideDeck] Cleaning up ${uploadedPaths.length} orphaned files after failure.`);
          const bucket = admin.storage().bucket();
          await Promise.allSettled(uploadedPaths.map(p => bucket.file(p).delete().catch(() => { /* ignore cleanup errors */ })));
        }
        throw innerError;
      }
    } catch (error) {
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
    const userId = validateAuth(request);
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
      const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
      for (const slide of slideDeck.slides) {
        if (slide.imageStoragePath) {
          try {
            const encodedPath = encodeURIComponent(slide.imageStoragePath);
            if (emulatorHost) {
              // Storage emulator does not support signed URLs — use direct download URL
              const token = slide.imageDownloadToken ? `&token=${slide.imageDownloadToken}` : '';
              slide.imageUrl = `http://${emulatorHost}/v0/b/${bucket.name}/o/${encodedPath}?alt=media${token}`;
            } else if (slide.imageDownloadToken) {
              // Use the Firebase Storage download token stored at upload time.
              // This avoids the iam.serviceAccounts.signBlob permission requirement
              // and produces a stable, permanent URL.
              slide.imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${slide.imageDownloadToken}`;
            } else {
              // Fallback: signed URL (requires signBlob IAM permission on the service account)
              const [url] = await bucket.file(slide.imageStoragePath).getSignedUrl({
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000, // 1 hour
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
    logger.error(`Error fetching slide deck:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Could not fetch slide deck.');
  }
});

/**
 * Lists all slide decks for the authenticated user.
 */
export const getUserSlideDecks = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  try {
    const userId = validateAuth(request);

    const snapshot = await admin.firestore()
      .collection('users').doc(userId).collection('slideDecks')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const slideDecks: Partial<SlideDeck>[] = [];
    snapshot.forEach(doc => {
      slideDecks.push({ ...doc.data(), id: doc.id });
    });

    return { success: true, data: slideDecks };
  } catch (error) {
    logger.error('Error listing user slide decks:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Could not list slide decks.');
  }
});

/**
 * Deletes a slide deck and its associated storage files.
 */
export const deleteSlideDeck = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  try {
    const userId = validateAuth(request);
    const parseResult = slideDeckIdRequestSchema.safeParse(request.data);
    if (!parseResult.success) {
      throw new HttpsError('invalid-argument', parseResult.error.issues[0]?.message ?? 'Invalid request.');
    }
    const { slideDeckId } = parseResult.data;

    const docRef = FirestorePaths.slideDecks(userId).doc(slideDeckId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new HttpsError('not-found', 'No slide deck found with that ID.');
    }

    // Delete associated storage files
    const data = docSnap.data() as SlideDeck;
    if (data?.slides) {
      for (const slide of data.slides) {
        if (slide.imageStoragePath) {
          try {
            await admin.storage().bucket().file(slide.imageStoragePath).delete();
          } catch {
            logger.warn(`Failed to delete slide image: ${slide.imageStoragePath}`);
          }
        }
      }
    }

    const db = admin.firestore();
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists) {
        throw new HttpsError('not-found', 'No slide deck found with that ID.');
      }
      const deck = snap.data() as SlideDeck;
      transaction.delete(docRef);
      if (deck.directoryId) {
        transaction.update(FirestorePaths.directory(userId, deck.directoryId), {
          slideDeckCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
    return { success: true };
  } catch (error) {
    logger.error('Error deleting slide deck:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Could not delete slide deck.');
  }
});
