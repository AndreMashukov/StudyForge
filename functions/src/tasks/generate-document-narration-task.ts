import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  runNarrationTask,
  sweepStaleNarrationRuns,
} from '@study-forge/backend-documents/narration/narration-generation-service';
import {
  isNarrationRunTaskPayload,
  type INarrationRunTaskPayload,
} from '@study-forge/backend-documents/narration/narration-task-queue';

const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

/**
 * Generates the pending parts of one narration run (ADR 013). One attempt: a
 * run is claimed once and settled once, and parts it did not reach are marked
 * failed for the learner to retry.
 */
export const generateDocumentNarrationTask =
  onTaskDispatched<INarrationRunTaskPayload>(
    {
      region: 'asia-east1',
      retryConfig: { maxAttempts: 1 },
      rateLimits: { maxConcurrentDispatches: 20 },
      secrets: [llmSettingsEncryptionKey],
      timeoutSeconds: 540,
      memory: '1GiB',
      cpu: 1,
      concurrency: 4,
      maxInstances: 20,
    },
    async (request) => {
      if (!isNarrationRunTaskPayload(request.data)) {
        logger.error('Narration task payload is invalid');
        return;
      }
      await runNarrationTask(request.data);
    },
  );

/** Settles narration runs whose worker died, so credits and storage are never held for good. */
export const sweepStaleNarrationRunsSchedule = onSchedule(
  {
    region: 'asia-east1',
    schedule: 'every 30 minutes',
    timeZone: 'UTC',
    secrets: [llmSettingsEncryptionKey],
  },
  async () => {
    try {
      await sweepStaleNarrationRuns();
    } catch (error) {
      logger.error('Stale narration run sweep failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);
