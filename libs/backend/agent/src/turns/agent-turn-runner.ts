import { logger } from 'firebase-functions/v2';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import {
  buildProviderCostContext,
  runWithProviderCostContext,
} from '@study-forge/backend-core/services/provider-cost';
import { isRetryableGenerationError } from '@study-forge/backend-generation/generation-job-retry';
import {
  executeAgentTurn,
  type IAgentTurnOutcome,
} from '../directory-agent-service';
import { FAILED_AGENT_REPLY } from '../runner/agent-chat-fallback';
import { readAgentTurnAbortReason } from '../runner/agent-request-abort';
import { MAX_AGENT_TURN_ATTEMPTS } from './agent-turn-decisions';
import {
  finalizeAgentTurn,
  type IAgentTurnTerminalState,
} from './agent-turn-finalize';
import { AgentTurnProgressWriter } from './agent-turn-progress-writer';
import type { AgentTurnRecord } from './agent-turn-record';
import {
  buildStaleTurnState,
  claimAgentTurn,
  releaseAgentTurnLease,
} from './agent-turn-service';
import type { IRunAgentTurnTaskPayload } from './agent-turn-task-queue';

/**
 * Soft deadline inside the 540s task timeout. It leaves time to finalize,
 * capture memories, settle credits and flush traces before a hard kill.
 */
export const AGENT_TURN_SOFT_DEADLINE_MS = 480_000;

function toTerminalState(outcome: IAgentTurnOutcome): IAgentTurnTerminalState {
  const lists = {
    executedActions: outcome.executedActions,
    proposedDeletes: outcome.proposedDeletes,
    referencedItems: outcome.referencedItems,
    ...(outcome.retrievedTexts
      ? { evalRetrievedTexts: outcome.retrievedTexts }
      : {}),
  };
  switch (outcome.kind) {
    case 'completed':
      return {
        status: 'completed',
        incomplete: false,
        reply: outcome.reply,
        error: null,
        ...lists,
        ...(outcome.questions?.length ? { questions: outcome.questions } : {}),
      };
    case 'incomplete':
      return {
        status: 'completed',
        incomplete: true,
        reply: outcome.reply,
        error: outcome.errorMessage
          ? {
              code: outcome.errorCode ?? 'internal',
              message: outcome.errorMessage,
            }
          : null,
        ...lists,
      };
    case 'cancelled':
      return {
        status: 'cancelled',
        incomplete: false,
        reply: outcome.reply,
        error: null,
        ...lists,
      };
    case 'failed':
      return {
        status: 'failed',
        incomplete: false,
        reply:
          outcome.reply.trim().length > 0 ? outcome.reply : FAILED_AGENT_REPLY,
        error: {
          code: 'internal',
          message: outcome.errorMessage ?? 'Agent execution failed',
        },
        ...lists,
      };
  }
}

function failedOutcome(
  turn: AgentTurnRecord,
  error: unknown,
): IAgentTurnOutcome {
  return {
    kind: 'failed',
    reply: FAILED_AGENT_REPLY,
    executedActions: turn.executedActions,
    proposedDeletes: turn.proposedDeletes,
    referencedItems: turn.referencedItems,
    errorMessage: error instanceof Error ? error.message : String(error),
    cause: error,
  };
}

/**
 * Body of the runAgentTurnTask Cloud Task. Throws only to ask Cloud Tasks for
 * a retry; every other ending finalizes the turn.
 */
export async function runAgentTurnTask(
  payload: IRunAgentTurnTaskPayload,
  context: { retryCount: number },
): Promise<void> {
  const { userId, threadId, turnId } = payload;
  const claim = await claimAgentTurn({
    userId,
    threadId,
    turnId,
    retryCount: context.retryCount,
  });

  if (claim.decision.type === 'skip') {
    logger.info('Skipping agent turn task', {
      userId,
      threadId,
      turnId,
      reason: claim.decision.reason,
    });
    return;
  }
  if (claim.decision.type === 'finalize-cancelled' && claim.turn) {
    await finalizeAgentTurn({
      userId,
      threadId,
      turnId,
      state: buildStaleTurnState(claim.turn, 'cancelled'),
      settlement: claim.turn.status === 'queued' ? 'refund' : 'settle',
    });
    return;
  }
  if (claim.decision.type === 'fail-exhausted' && claim.turn) {
    await finalizeAgentTurn({
      userId,
      threadId,
      turnId,
      state: buildStaleTurnState(claim.turn, 'failed'),
      settlement: 'settle',
    });
    return;
  }
  if (!('leaseId' in claim)) {
    return;
  }

  const { turn, leaseId } = claim;
  const isRetry = claim.decision.type === 'reclaim';
  const controller = new AbortController();
  const deadlineTimer = setTimeout(
    () => controller.abort('deadline'),
    AGENT_TURN_SOFT_DEADLINE_MS,
  );
  const writer = new AgentTurnProgressWriter({
    turnRef: FirestorePaths.agentThreadTurn(userId, threadId, turnId),
    leaseId,
    onControl: (reason) => controller.abort(reason),
    initial: {
      executedActions: turn.executedActions,
      proposedDeletes: turn.proposedDeletes,
      referencedItems: turn.referencedItems,
    },
  });
  writer.start();

  const costContext = buildProviderCostContext({
    userId,
    generationKind: turn.usage.usageKind,
    reservationId: turn.usage.reservationId,
    threadId,
    callRole: 'agent_step',
    loopBudgetCredits: turn.usage.loopBudgetCredits,
    pricePerCreditCents: turn.usage.pricePerCreditCents,
    ...(turn.usage.periodKey ? { periodKey: turn.usage.periodKey } : {}),
  });

  try {
    await runWithProviderCostContext(costContext, async () => {
      let outcome: IAgentTurnOutcome;
      try {
        outcome = await executeAgentTurn(
          {
            userId,
            threadId,
            turnId,
            request: {
              scope: turn.scope,
              directoryId: turn.request.directoryId ?? turn.directoryId,
              message: turn.request.message,
              promptContext: turn.request.promptContext,
              clientLocalDate: turn.request.clientLocalDate,
            },
            resume: isRetry,
            seed: isRetry
              ? {
                  executedActions: turn.executedActions,
                  proposedDeletes: turn.proposedDeletes,
                  referencedItems: turn.referencedItems,
                }
              : undefined,
            attempt: turn.attempt,
          },
          {
            onEvent: (event) => writer.push(event),
            signal: controller.signal,
          },
        );
      } catch (error) {
        // Context building failed (directory tree, memories, history).
        outcome = failedOutcome(turn, error);
      }

      clearTimeout(deadlineTimer);
      await writer.close();

      if (readAgentTurnAbortReason(controller.signal) === 'superseded') {
        logger.warn('Agent turn superseded; leaving it to the newer attempt', {
          userId,
          threadId,
          turnId,
          attempt: turn.attempt,
        });
        return;
      }

      if (
        outcome.kind === 'failed' &&
        turn.attempt < MAX_AGENT_TURN_ATTEMPTS &&
        isRetryableGenerationError(outcome.cause)
      ) {
        logger.warn('Agent turn failed with a retryable error; retrying', {
          userId,
          threadId,
          turnId,
          attempt: turn.attempt,
          error: outcome.errorMessage,
        });
        await releaseAgentTurnLease({ userId, threadId, turnId, leaseId });
        throw outcome.cause instanceof Error
          ? outcome.cause
          : new Error(outcome.errorMessage ?? 'Agent turn failed');
      }

      const finalized = await finalizeAgentTurn({
        userId,
        threadId,
        turnId,
        state: toTerminalState(outcome),
        guard: (current) => current.leaseId === leaseId,
        settlement: 'settle',
        captureMemories: outcome.kind === 'completed',
      });

      logger.info('Agent turn finished', {
        userId,
        threadId,
        turnId,
        attempt: turn.attempt,
        outcome: outcome.kind,
        finalized: finalized.didTransition,
        ...(outcome.errorMessage ? { error: outcome.errorMessage } : {}),
      });
    });
  } finally {
    clearTimeout(deadlineTimer);
    await writer.close();
  }
}
