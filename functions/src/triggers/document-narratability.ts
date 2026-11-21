import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { judgeDocumentNarratability } from '@study-forge/backend-documents/narration/narratability-service';
import {
  narrationContentFieldsChanged,
  readNarrationDocumentFields,
} from '@study-forge/backend-documents/narration/narration-source';
import { removeNarration } from '@study-forge/backend-documents/narration/narration-store';

const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

/**
 * Keeps each document's narratable check current (ADR 013): judges a document
 * when its content becomes ready or changes, and removes its narration when it
 * is deleted. Writes that touch nothing spoken return before any read.
 */
export const syncDocumentNarratability = onDocumentWritten(
  {
    document: 'users/{userId}/documents/{documentId}',
    region: 'asia-east1',
    secrets: [llmSettingsEncryptionKey],
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async (event) => {
    const { userId, documentId } = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    try {
      if (!after || after.status === 'deleted') {
        if (before && before.status !== 'deleted') {
          await removeNarration(userId, documentId);
        }
        return;
      }
      if (before && !narrationContentFieldsChanged(before, after)) {
        return;
      }
      await judgeDocumentNarratability({
        userId,
        documentId,
        document: readNarrationDocumentFields(after),
      });
    } catch (error) {
      logger.error('Document narratability sync failed', {
        userId,
        documentId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
