import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import {
  cancelAgentTurnRequestSchema,
  CancelAgentTurnResponse,
  ListSuggestedAgentPromptsResponse,
  startAgentTurnRequestSchema,
  StartAgentTurnResponse,
} from '@shared-types';
import { validateVerifiedAuth } from '@study-forge/backend-core/lib/auth';
import { cancelAgentTurn, startAgentTurn } from '@study-forge/backend-agent';
import { listSuggestedAgentPrompts } from '@study-forge/backend-directories/rule-blueprints';

/** Starts a durable agent turn; the reply arrives through the turn doc. */
export const startAgentTurnEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
    timeoutSeconds: 60,
  },
  async (request): Promise<StartAgentTurnResponse> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const parsed = startAgentTurnRequestSchema.safeParse(request.data);
      if (!parsed.success) {
        throw new HttpsError(
          'invalid-argument',
          parsed.error.issues.map((issue) => issue.message).join('; '),
        );
      }
      return await startAgentTurn(userId, parsed.data);
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('Failed to start agent turn', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError('internal', 'Failed to start the agent');
    }
  },
);

/** Stop for a running agent turn. */
export const cancelAgentTurnEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
    timeoutSeconds: 60,
  },
  async (request): Promise<CancelAgentTurnResponse> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const parsed = cancelAgentTurnRequestSchema.safeParse(request.data);
      if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'threadId and turnId are required');
      }
      return await cancelAgentTurn(userId, parsed.data);
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('Failed to cancel agent turn', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError('internal', 'Failed to stop the agent');
    }
  },
);

/** Published agent blueprints for the "/" menu (suggested agent prompts, ADR 017). */
export const listSuggestedAgentPromptsEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
    timeoutSeconds: 30,
  },
  async (request): Promise<ListSuggestedAgentPromptsResponse> => {
    try {
      await validateVerifiedAuth(request);
      return { success: true, prompts: await listSuggestedAgentPrompts() };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('Failed to list suggested agent prompts', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError('internal', 'Failed to load suggested prompts');
    }
  },
);
