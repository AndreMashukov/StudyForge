import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import {
  Flashcard,
  FlashcardSet,
  GenerateFlashcardsRequest,
  UpdateFlashcardSetRequest
} from '@shared-types';
import { DocumentCrudService } from '../services/document-crud';
import { DocumentService } from '../services/document-storage';
import { GeminiService } from '../services/gemini/gemini';

// Helper to validate authentication
const validateAuth = (context: { auth?: { uid?: string } }): string => {
  if (!context.auth || !context.auth.uid) {
    logger.error('Authentication error: User must be logged in.');
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }
  return context.auth.uid;
};

// Helper function that contains the core generation logic
async function generateFlashcardsFromContent(content: string, title: string): Promise<Pick<FlashcardSet, 'title' | 'flashcards'>> {
  const generatedFlashcards = await GeminiService.generateFlashcards(content);

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
export const generateFlashcards = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  try {
    const userId = validateAuth(request);
    const { documentId } = request.data as GenerateFlashcardsRequest;

    if (!documentId) {
      throw new HttpsError('invalid-argument', 'The function must be called with a "documentId".');
    }

    // Step 1: Function start
    logger.info(`[generateFlashcards] STEP 1: Function started.`, { userId, documentId });

    // Step 2: Before fetching document
    logger.info(`[generateFlashcards] STEP 2: Calling DocumentCrudService.getDocumentWithContent.`, { userId, documentId });

    const document = await DocumentCrudService.getDocumentWithContent(userId, documentId);

    // Step 3: After fetching document
    logger.info(`[generateFlashcards] STEP 3: Document retrieved. Title: "${document?.title ?? 'N/A'}"`, { userId, documentId });

    if (!document || !document.content) {
      throw new HttpsError('not-found', 'The specified document does not exist or has no content.');
    }

    // Step 4: Before calling Gemini
    logger.info(`[generateFlashcards] STEP 4: Calling generateFlashcardsFromContent (GeminiService).`, { userId, documentId, title: document.title });

    const generatedData = await generateFlashcardsFromContent(document.content, document.title);

    // Step 5: After Gemini returns
    logger.info(`[generateFlashcards] STEP 5: Flashcard generation complete. Flashcards created: ${generatedData.flashcards.length}`, { userId, documentId });

    const newFlashcardSetData = {
      ...generatedData,
      userId,
      documentId,
      documentTitle: document.title,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Step 6: Before Firestore add
    logger.info(`[generateFlashcards] STEP 6: Adding new flashcard set to Firestore.`, { userId, documentId });

    const docRef = await admin.firestore().collection('users').doc(userId).collection('flashcardSets').add(newFlashcardSetData);

    // Step 7: After Firestore add
    logger.info(`[generateFlashcards] STEP 7: Firestore add complete. New document ID: ${docRef.id}`, { userId, documentId });

    // Step 8: Before return
    logger.info(`[generateFlashcards] STEP 8: Returning success response.`, { userId, documentId, flashcardSetId: docRef.id });

    return { success: true, flashcardSetId: docRef.id };

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
    const { flashcardSetId } = request.data as { flashcardSetId: string };

    const doc = await admin.firestore().collection('users').doc(userId).collection('flashcardSets').doc(flashcardSetId).get();

    if (!doc.exists) {
      throw new HttpsError('not-found', 'No flashcard set found with that ID.');
    }
    return { id: doc.id, ...doc.data() } as FlashcardSet;
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

    const snapshot = await admin.firestore().collection('users').doc(userId).collection('flashcardSets').orderBy('createdAt', 'desc').get();
    
    const flashcardSets: Partial<FlashcardSet>[] = [];
    snapshot.forEach(doc => {
        flashcardSets.push({ id: doc.id, ...doc.data() });
    });

    return flashcardSets;
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
    const { flashcardSetId, title, flashcards } = request.data as UpdateFlashcardSetRequest;

    const docRef = admin.firestore().collection('users').doc(userId).collection('flashcardSets').doc(flashcardSetId);
    
    const updateData: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (title) updateData.title = title;
    if (flashcards) updateData.flashcards = flashcards;

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
    const { flashcardSetId } = request.data as { flashcardSetId: string };

    await admin.firestore().collection('users').doc(userId).collection('flashcardSets').doc(flashcardSetId).delete();

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
 * Remove or restrict this before production deployment.
 */
export const debugStorageBucket = onCall({ region: 'asia-east1', cors: true }, async (_request) => {
  try {
    const result = await DocumentService.debugBucket();
    logger.info('debugStorageBucket result', result);
    return result;
  } catch (error) {
    logger.error('debugStorageBucket error:', error);
    throw new HttpsError('internal', String(error));
  }
});
