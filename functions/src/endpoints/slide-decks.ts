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

      logger.info('[generateSlideDeck] STEP 1: Function started.', {
        userIdHash: u,
        documentIdHash: d,
        hasCustomTitle: !!customTitle,
        hasAdditionalPrompt: !!additionalPrompt,
        ruleCount: ruleIds?.length || 0,
      });

      const document = await DocumentCrudService.getDocumentWithContent(userId, documentId);
      logger.info(`[generateSlideDeck] STEP 2: Document retrieved. Title: "${document?.title ?? 'N/A'}"`, { userIdHash: u });

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

      // Step 4: Generate images for each slide
      const slides: Slide[] = [];
      for (let i = 0; i < slideOutline.length; i++) {
        const outline = slideOutline[i];
        const slideId = admin.firestore().collection('tmp').doc().id;

        logger.info(`[generateSlideDeck] STEP 5.${i}: Generating image for slide "${outline.title}"`, { userIdHash: u });
        const imageBase64 = await GeminiService.generateSlideImage(outline.title, outline.content);

        let imageStoragePath: string | undefined;
        if (imageBase64) {
          const path = `users/${userId}/slideDecks/temp-${slideId}/slide-${i}.png`;
          const file = admin.storage().bucket().file(path);
          await file.save(Buffer.from(imageBase64, 'base64'), {
            metadata: { contentType: 'image/png' },
            resumable: false,
          });
          imageStoragePath = path;
          logger.info(`[generateSlideDeck] Image saved for slide ${i}`, { userIdHash: u });
        }

        slides.push({
          id: slideId,
          title: outline.title,
          content: outline.content,
          imageStoragePath,
          speakerNotes: outline.speakerNotes,
        });
      }

      // Step 5: Save to Firestore
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

      // Update storage paths with actual deck ID
      const batch = admin.firestore().batch();
      const updatedSlides = slides.map((slide, i) => {
        if (slide.imageStoragePath) {
          const newPath = `users/${userId}/slideDecks/${docRef.id}/slide-${i}.png`;
          // Move file in storage (copy + delete) is complex; keep temp path for now
          return { ...slide, imageStoragePath: slide.imageStoragePath };
        }
        return slide;
      });

      if (updatedSlides.some(s => s.imageStoragePath)) {
        batch.update(docRef, { slides: updatedSlides });
        await batch.commit();
      }

      logger.info(`[generateSlideDeck] STEP 7: Complete. Deck ID: ${redactId(docRef.id)}`, { userIdHash: u });

      return { success: true, data: { slideDeckId: docRef.id } };
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
