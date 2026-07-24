import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import {
  BulkDeletableArtifactType,
  FlashcardSet,
  SlideDeck,
} from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import {
  removeArtifactDirectoryIndex,
  syncIndexSafely,
} from '@study-forge/backend-directories/directory-item-index';
import { FirestoreService } from './firestore';

/**
 * Deletes a flashcard set and updates directory counts / index rows.
 */
export async function deleteFlashcardSetForUser(
  userId: string,
  flashcardSetId: string,
): Promise<void> {
  const docRef = FirestorePaths.flashcardSets(userId).doc(flashcardSetId);
  const db = admin.firestore();
  const preSnap = await docRef.get();
  const directoryId = preSnap.exists
    ? (preSnap.data() as FlashcardSet).directoryId
    : undefined;

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'No flashcard set found with that ID.');
    }
    const existing = snap.data() as FlashcardSet;
    transaction.delete(docRef);
    const gs = existing.generationStatus;
    if (existing.directoryId && (!gs || gs === 'completed')) {
      transaction.update(FirestorePaths.directory(userId, existing.directoryId), {
        flashcardSetCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  if (directoryId) {
    await syncIndexSafely('deleteFlashcardSet', () =>
      removeArtifactDirectoryIndex(userId, directoryId, 'flashcard', flashcardSetId),
    );
  }
}

/**
 * Deletes a slide deck, its storage images, and directory counts / index rows.
 */
export async function deleteSlideDeckForUser(
  userId: string,
  slideDeckId: string,
): Promise<void> {
  const docRef = FirestorePaths.slideDecks(userId).doc(slideDeckId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new HttpsError('not-found', 'No slide deck found with that ID.');
  }

  const data = docSnap.data() as SlideDeck;
  const directoryId = data.directoryId;
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
    const gs = deck.generationStatus;
    if (deck.directoryId && (!gs || gs === 'completed')) {
      transaction.update(FirestorePaths.directory(userId, deck.directoryId), {
        slideDeckCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  if (directoryId) {
    await syncIndexSafely('deleteSlideDeck', () =>
      removeArtifactDirectoryIndex(userId, directoryId, 'slideDeck', slideDeckId),
    );
  }
}

/**
 * Dispatches artifact deletion by type to the same cleanup paths used by single-delete callables.
 */
export async function deleteArtifactByType(
  userId: string,
  type: BulkDeletableArtifactType,
  artifactId: string,
): Promise<void> {
  switch (type) {
    case 'quiz':
      await FirestoreService.deleteQuiz(artifactId, userId);
      return;
    case 'flashcard':
      await deleteFlashcardSetForUser(userId, artifactId);
      return;
    case 'slideDeck':
      await deleteSlideDeckForUser(userId, artifactId);
      return;
    case 'diagramQuiz':
      await FirestoreService.deleteDiagramQuiz(artifactId, userId);
      return;
    case 'sequenceQuiz':
      await FirestoreService.deleteSequenceQuiz(artifactId, userId);
      return;
    case 'subjectWorld':
      await FirestoreService.deleteSubjectWorld(artifactId, userId);
      return;
    default: {
      const _exhaustive: never = type;
      throw new HttpsError('invalid-argument', `Unsupported artifact type: ${String(_exhaustive)}`);
    }
  }
}
