import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import {
  getAgentThreadRequestSchema,
  GetAgentThreadResponse,
  listAgentThreadsRequestSchema,
  ListAgentThreadsResponse,
} from '@shared-types';
import { validateAuth } from '@study-forge/backend-core/lib/auth';
import { AgentThreadStore } from '@study-forge/backend-agent';

export const getAgentThread = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request): Promise<GetAgentThreadResponse> => {
    try {
      const userId = validateAuth(request);
      const parsed = getAgentThreadRequestSchema.safeParse(request.data);
      if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'threadId is required');
      }

      const result = await AgentThreadStore.getThread(
        userId,
        parsed.data.threadId,
      );
      if (!result) {
        throw new HttpsError('not-found', 'Agent thread not found');
      }

      return result;
    } catch (error) {
      logger.error('Failed to get agent thread', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  },
);

export const listAgentThreads = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request): Promise<ListAgentThreadsResponse> => {
    try {
      const userId = validateAuth(request);
      const parsed = listAgentThreadsRequestSchema.safeParse(
        request.data ?? {},
      );
      if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'Invalid list request');
      }

      const threads = await AgentThreadStore.listThreads(
        userId,
        parsed.data.limit,
      );
      return { threads };
    } catch (error) {
      logger.error('Failed to list agent threads', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  },
);
