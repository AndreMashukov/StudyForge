import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  BulkDeletableArtifactType,
  IBulkDeleteArtifactItem,
  IBulkOperationResponse,
} from '@shared-types';
import { validateAuth } from '../lib/auth';
import { deleteArtifactByType } from '../services/artifact-delete';
import { executeBulkOperation } from '../services/bulk-operation';

const BULK_DELETABLE_ARTIFACT_TYPES = new Set<BulkDeletableArtifactType>([
  'quiz',
  'flashcard',
  'slideDeck',
  'diagramQuiz',
  'sequenceQuiz',
  'subjectWorld',
]);

function isBulkDeleteArtifactItem(value: unknown): value is IBulkDeleteArtifactItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as { id?: unknown; type?: unknown };
  return (
    typeof record.id === 'string' &&
    typeof record.type === 'string' &&
    BULK_DELETABLE_ARTIFACT_TYPES.has(record.type as BulkDeletableArtifactType)
  );
}

/**
 * Best-effort bulk delete for directory artifacts (quizzes, flashcards, slides, etc.).
 */
export const bulkDeleteArtifacts = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request): Promise<IBulkOperationResponse> => {
    const userId = validateAuth(request);
    const { artifacts } = (request.data ?? {}) as { artifacts?: unknown };

    if (!Array.isArray(artifacts) || !artifacts.every(isBulkDeleteArtifactItem)) {
      throw new HttpsError(
        'invalid-argument',
        'artifacts must be an array of { id, type } items.',
      );
    }

    return executeBulkOperation({
      items: artifacts,
      getItemId: (item) => item.id,
      runItem: (item) => deleteArtifactByType(userId, item.type, item.id),
    });
  },
);
