import {
  deleteObject,
  ref,
} from 'firebase/storage';
import {
  deleteDoc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import type {
  BulkDeletableArtifactType,
  GenerationStatus,
  SlideDeck,
  UpdateFlashcardSetRequest,
} from '@shared-types';
import { db, storage } from '../config/firebase';
import {
  fetchAllUserDocsPaginated,
  FIRESTORE_ARTIFACTS_LIST_LIMIT,
} from './firestoreReadUtils';
import {
  diagramQuizRef,
  directoryRef,
  flashcardSetRef,
  quizRef,
  sequenceQuizRef,
  slideDeckRef,
} from './firestorePaths';
import {
  removeArtifactDirectoryIndex,
  syncArtifactDirectoryIndex,
  syncIndexSafely,
} from './directoryItemIndexMutations';

const ARTIFACT_COUNT_FIELD: Record<
  BulkDeletableArtifactType,
  'quizCount' | 'flashcardSetCount' | 'slideDeckCount' | 'diagramQuizCount' | 'sequenceQuizCount'
> = {
  quiz: 'quizCount',
  flashcard: 'flashcardSetCount',
  slideDeck: 'slideDeckCount',
  diagramQuiz: 'diagramQuizCount',
  sequenceQuiz: 'sequenceQuizCount',
};

function shouldDecrementCount(generationStatus: GenerationStatus | undefined): boolean {
  return !generationStatus || generationStatus === 'completed';
}

function getArtifactDocRef(
  userId: string,
  type: BulkDeletableArtifactType,
  artifactId: string,
) {
  switch (type) {
    case 'quiz':
      return quizRef(userId, artifactId);
    case 'flashcard':
      return flashcardSetRef(userId, artifactId);
    case 'slideDeck':
      return slideDeckRef(userId, artifactId);
    case 'diagramQuiz':
      return diagramQuizRef(userId, artifactId);
    case 'sequenceQuiz':
      return sequenceQuizRef(userId, artifactId);
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unsupported artifact type: ${String(_exhaustive)}`);
    }
  }
}

function getIndexItemType(
  type: BulkDeletableArtifactType,
): 'quiz' | 'flashcard' | 'slideDeck' | 'diagramQuiz' | 'sequenceQuiz' {
  return type === 'flashcard' ? 'flashcard' : type;
}

async function deleteSlideDeckImages(slideDeck: SlideDeck): Promise<void> {
  for (const slide of slideDeck.slides || []) {
    if (!slide.imageStoragePath) {
      continue;
    }
    try {
      await deleteObject(ref(storage, slide.imageStoragePath));
    } catch {
      console.warn('Failed to delete slide image:', slide.imageStoragePath);
    }
  }
}

async function deleteArtifactWithIndex(
  userId: string,
  type: BulkDeletableArtifactType,
  artifactId: string,
): Promise<void> {
  const artifactDocRef = getArtifactDocRef(userId, type, artifactId);
  const preSnap = await getDoc(artifactDocRef);
  const directoryId = preSnap.exists()
    ? (preSnap.data().directoryId as string | undefined)
    : undefined;

  const slideDeckData = type === 'slideDeck' && preSnap.exists()
    ? (preSnap.data() as SlideDeck)
    : undefined;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(artifactDocRef);
    if (!snap.exists()) {
      throw new Error('Artifact not found');
    }
    const data = snap.data();
    const gs = data.generationStatus as GenerationStatus | undefined;
    transaction.delete(artifactDocRef);
    const dirId = data.directoryId as string | undefined;
    if (dirId && shouldDecrementCount(gs)) {
      transaction.update(directoryRef(userId, dirId), {
        [ARTIFACT_COUNT_FIELD[type]]: increment(-1),
        updatedAt: serverTimestamp(),
      });
    }
  });

  if (slideDeckData) {
    await deleteSlideDeckImages(slideDeckData);
  }

  if (directoryId) {
    await syncIndexSafely(`delete${type}`, () =>
      removeArtifactDirectoryIndex(
        userId,
        directoryId,
        getIndexItemType(type),
        artifactId,
      ),
    );
  }
}

export async function deleteQuizInFirestore(
  userId: string,
  quizId: string,
): Promise<void> {
  await deleteArtifactWithIndex(userId, 'quiz', quizId);
}

export async function deleteFlashcardSetInFirestore(
  userId: string,
  flashcardSetId: string,
): Promise<void> {
  await deleteArtifactWithIndex(userId, 'flashcard', flashcardSetId);
}

export async function deleteSlideDeckInFirestore(
  userId: string,
  slideDeckId: string,
): Promise<void> {
  await deleteArtifactWithIndex(userId, 'slideDeck', slideDeckId);
}

export async function deleteDiagramQuizInFirestore(
  userId: string,
  diagramQuizId: string,
): Promise<void> {
  await deleteArtifactWithIndex(userId, 'diagramQuiz', diagramQuizId);
}

export async function deleteSequenceQuizInFirestore(
  userId: string,
  sequenceQuizId: string,
): Promise<void> {
  await deleteArtifactWithIndex(userId, 'sequenceQuiz', sequenceQuizId);
}

export async function deleteArtifactByTypeInFirestore(
  userId: string,
  type: BulkDeletableArtifactType,
  artifactId: string,
): Promise<void> {
  switch (type) {
    case 'quiz':
      await deleteQuizInFirestore(userId, artifactId);
      return;
    case 'flashcard':
      await deleteFlashcardSetInFirestore(userId, artifactId);
      return;
    case 'slideDeck':
      await deleteSlideDeckInFirestore(userId, artifactId);
      return;
    case 'diagramQuiz':
      await deleteDiagramQuizInFirestore(userId, artifactId);
      return;
    case 'sequenceQuiz':
      await deleteSequenceQuizInFirestore(userId, artifactId);
      return;
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unsupported artifact type: ${String(_exhaustive)}`);
    }
  }
}

export async function updateFlashcardSetInFirestore(
  userId: string,
  request: UpdateFlashcardSetRequest,
): Promise<void> {
  const { flashcardSetId, title, flashcards } = request;
  const docRef = flashcardSetRef(userId, flashcardSetId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('No flashcard set found with that ID.');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (title !== undefined) updateData.title = title;
  if (flashcards !== undefined) updateData.flashcards = flashcards;

  await updateDoc(docRef, updateData);
  await syncIndexSafely('updateFlashcardSet', () =>
    syncArtifactDirectoryIndex(userId, 'flashcard', flashcardSetId),
  );
}

export async function deleteArtifactsByDocumentId(
  userId: string,
  documentId: string,
): Promise<void> {
  const collections: Array<{
    name: string;
    type: BulkDeletableArtifactType;
    indexType: ReturnType<typeof getIndexItemType>;
    countField: typeof ARTIFACT_COUNT_FIELD[BulkDeletableArtifactType];
  }> = [
    { name: 'quizzes', type: 'quiz', indexType: 'quiz', countField: 'quizCount' },
    {
      name: 'flashcardSets',
      type: 'flashcard',
      indexType: 'flashcard',
      countField: 'flashcardSetCount',
    },
    {
      name: 'slideDecks',
      type: 'slideDeck',
      indexType: 'slideDeck',
      countField: 'slideDeckCount',
    },
    {
      name: 'diagramQuizzes',
      type: 'diagramQuiz',
      indexType: 'diagramQuiz',
      countField: 'diagramQuizCount',
    },
    {
      name: 'sequenceQuizzes',
      type: 'sequenceQuiz',
      indexType: 'sequenceQuiz',
      countField: 'sequenceQuizCount',
    },
  ];

  for (const col of collections) {
    const artifactDocs = await fetchAllUserDocsPaginated(
      userId,
      col.name,
      [where('documentId', '==', documentId)],
      FIRESTORE_ARTIFACTS_LIST_LIMIT,
    );

    for (const artifactDoc of artifactDocs) {
      const data = artifactDoc.data();
      const directoryId = data.directoryId as string | undefined;
      const gs = data.generationStatus as GenerationStatus | undefined;

      await deleteDoc(artifactDoc.ref);

      if (col.type === 'slideDeck') {
        await deleteSlideDeckImages(data as SlideDeck);
      }

      if (directoryId) {
        await syncIndexSafely(`deleteDocument.${col.type}`, () =>
          removeArtifactDirectoryIndex(userId, directoryId, col.indexType, artifactDoc.id),
        );
      }

      if (directoryId && shouldDecrementCount(gs)) {
        try {
          await updateDoc(directoryRef(userId, directoryId), {
            [col.countField]: increment(-1),
            updatedAt: serverTimestamp(),
          });
        } catch {
          /* ignore count drift */
        }
      }
    }
  }
}

export async function bulkDeleteArtifactsInFirestore(
  userId: string,
  items: Array<{ type: BulkDeletableArtifactType; artifactId: string }>,
): Promise<void> {
  for (const item of items) {
    await deleteArtifactByTypeInFirestore(userId, item.type, item.artifactId);
  }
}

export { recordLearnedVocabularyInFirestore } from './learnedVocabularyMutations';
