import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { z } from 'zod';

import { Slide, SlideDeck } from '@shared-types';
import { DocumentCrudService } from '../services/document-crud';
import { GeminiService } from '../services/gemini/gemini';
import { validateAuth } from '../lib/auth';
import { promptBuilder } from '../services/promptBuilder';

const redactId = (id: string): string =>
  createHash('sha256').update(id).digest('hex').slice(0, 8);

const geminiApiKey = defineSecret('GEMINI_API_KEY');

const generateSlideDeckRequestSchema = z.object({
  documentId: z.string().min(1, 'documentId is required'),
  title: z.string().max(100).optional(),
  additionalPrompt: z.string().max(500).optional(),
  ruleIds: z.array(z.string()).optional(),
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
        const msg = parseResult.error.issues[0]?.message ?? 'Invalid request payload.';
        throw new HttpsError('invalid-argument', msg);
      }
      const { documentId, title: customTitle, additionalPrompt, ruleIds } = parseResult.data;

      const u = redactId(userId);
      const d = redactId(documentId);
      const uploadedPaths: string[] = [];

      logger.info('[generateSlideDeck] STEP 1: Function started.', {
        userIdHash: u,
        documentIdHash: d,
        hasCustomTitle: !!customTitle,
        hasAdditionalPrompt: !!additionalPrompt,
        ruleCount: ruleIds?.length || 0,
      });

      try {
        const document = await DocumentCrudService.getDocumentWithContent(userId, documentId);
        logger.info('[generateSlideDeck] STEP 2: Document retrieved.', { userIdHash: u, documentIdHash: d });

        if (!document || !document.content) {
          throw new HttpsError('not-found', 'The specified document does not exist or has no content.');
        }

        // Inject rules if provided
        let enhancedPrompt = additionalPrompt || '';
        if (ruleIds?.length) {
          logger.info('[generateSlideDeck] STEP 2.5: Injecting rules.', { ruleCount: ruleIds.length });
          enhancedPrompt = await promptBuilder.injectRules(enhancedPrompt, ruleIds, userId);
        }

        // Step 3: Generate slide outline
        logger.info('[generateSlideDeck] STEP 3: Generating slide outline.', { userIdHash: u });
        const slideOutline = await GeminiService.generateSlideDeckOutline(document.content, enhancedPrompt);
        logger.info(`[generateSlideDeck] STEP 4: Outline generated. Slides: ${slideOutline.length}`, { userIdHash: u });

        // Step 5: Generate images with bounded concurrency (3 at a time)
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
            const imageBase64 = await GeminiService.generateSlideImage(slide.title, slide.content);
            if (imageBase64) {
              const storagePath = `users/${userId}/slideDecks/${slide.id}/slide-${i}.png`;
              const file = admin.storage().bucket().file(storagePath);
              await file.save(Buffer.from(imageBase64, 'base64'), {
                metadata: { contentType: 'image/png' },
                resumable: false,
              });
              slide.imageStoragePath = storagePath;
              uploadedPaths.push(storagePath);
            }
          }));
        }

        // Step 6: Save to Firestore
        const deckTitle = customTitle?.trim() || `Slides for "${document.title}"`;
        const newSlideDeckData = {
          title: deckTitle,
          slides,
          userId,
          documentId,
          documentTitle: document.title,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        logger.info('[generateSlideDeck] STEP 6: Saving to Firestore.', { userIdHash: u });
        const docRef = await admin.firestore()
          .collection('users').doc(userId).collection('slideDecks')
          .add(newSlideDeckData);

        logger.info(`[generateSlideDeck] STEP 7: Complete. Deck ID: ${redactId(docRef.id)}`, { userIdHash: u });

        return { success: true, data: { slideDeckId: docRef.id } };
      } catch (innerError) {
        // Cleanup orphaned storage files on failure
        if (uploadedPaths.length > 0) {
          logger.warn(`[generateSlideDeck] Cleaning up ${uploadedPaths.length} orphaned files after failure.`);
          const bucket = admin.storage().bucket();
          await Promise.allSettled(uploadedPaths.map(p => bucket.file(p).delete().catch(() => {})));
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
      for (const slide of slideDeck.slides) {
        if (slide.imageStoragePath) {
          try {
            const [url] = await bucket.file(slide.imageStoragePath).getSignedUrl({
              action: 'read',
              expires: Date.now() + 60 * 60 * 1000, // 1 hour
            });
            slide.imageUrl = url;
          } catch (err) {
            logger.warn(`Failed to get signed URL for ${slide.imageStoragePath}:`, err);
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

    const docRef = admin.firestore()
      .collection('users').doc(userId).collection('slideDecks').doc(slideDeckId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new HttpsError('not-found', 'No slide deck found with that ID.');
    }

    // Delete associated storage files
    const data = doc.data();
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

    await docRef.delete();
    return { success: true };
  } catch (error) {
    logger.error('Error deleting slide deck:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Could not delete slide deck.');
  }
});
