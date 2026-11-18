import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import {
  MAX_AGENT_TURN_ATTEMPTS,
  runAgentTurnTask as runAgentTurn,
  type IRunAgentTurnTaskPayload,
} from '@study-forge/backend-agent';
import { langsmithApiKey } from '../langsmith-secret';

const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

/**
 * Runs one durable agent turn (ADR 010). The turn survives the client closing:
 * progress and the final reply go to the turn doc, which clients follow.
 */
export const runAgentTurnTask = onTaskDispatched<IRunAgentTurnTaskPayload>(
  {
    region: 'asia-east1',
    retryConfig: {
      maxAttempts: MAX_AGENT_TURN_ATTEMPTS,
      minBackoffSeconds: 10,
      maxBackoffSeconds: 60,
      maxDoublings: 1,
    },
    rateLimits: {
      maxConcurrentDispatches: 30,
    },
    secrets: [llmSettingsEncryptionKey, langsmithApiKey],
    timeoutSeconds: 540,
    memory: '1GiB',
    cpu: 1,
    // Turns are mostly waiting on LLM calls, so one instance can run several.
    concurrency: 8,
    maxInstances: 20,
  },
  async (request) => {
    const { userId, threadId, turnId } = request.data;
    if (!userId || !threadId || !turnId) {
      logger.error('Agent turn task missing required payload fields', {
        userId,
        threadId,
        turnId,
      });
      return;
    }
    await runAgentTurn(
      { userId, threadId, turnId },
      { retryCount: request.retryCount ?? 0 },
    );
  },
);
