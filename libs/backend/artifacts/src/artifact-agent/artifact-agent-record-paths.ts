import type { ArtifactKind } from '@shared-types';
import type { DocumentReference } from 'firebase-admin/firestore';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';

export function recordRefForArtifactKind(
  userId: string,
  artifactKind: ArtifactKind,
  recordId: string
): DocumentReference {
  switch (artifactKind) {
    case 'diagramQuiz':
      return FirestorePaths.diagramQuiz(userId, recordId);
    case 'flashcards':
      return FirestorePaths.flashcardSet(userId, recordId);
    case 'slideDeck':
      return FirestorePaths.slideDeck(userId, recordId);
    case 'sequenceQuiz':
      return FirestorePaths.sequenceQuiz(userId, recordId);
    case 'subjectWorld':
      return FirestorePaths.subjectWorld(userId, recordId);
    case 'documentFromScreenshot':
      return FirestorePaths.document(userId, recordId);
    default: {
      const _exhaustive: never = artifactKind;
      throw new Error(`Unsupported artifact kind for record path: ${_exhaustive}`);
    }
  }
}

export function isArtifactKind(value: unknown): value is ArtifactKind {
  return (
    value === 'diagramQuiz'
    || value === 'flashcards'
    || value === 'slideDeck'
    || value === 'sequenceQuiz'
    || value === 'subjectWorld'
    || value === 'documentFromScreenshot'
  );
}
