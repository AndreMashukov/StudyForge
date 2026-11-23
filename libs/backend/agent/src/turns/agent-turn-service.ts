import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import type {
  CancelAgentTurnRequest,
  CancelAgentTurnResponse,
  StartAgentTurnInput,
  StartAgentTurnResponse,
} from '@shared-types';
import {
  AGENT_TURN_IN_PROGRESS_CODE,
  buildAgentUserMessageId,
  parseUserOnboarding,
  STARTER_COURSE_UNAVAILABLE_CODE,
} from '@shared-types';
import {
  applyStarterTurn,
  decideStarterTurn,
  serializeUserOnboarding,
  type StarterTurnDecision,
} from '@study-forge/backend-core/services/user-onboarding-logic';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import {
  enforceCallableAgentLoopLimits,
  refundUsageReservationSafe,
  settleAgentLoopUsageReservationSafe,
} from '@study-forge/backend-generation/generation-limits';
import {
  buildAgentThreadMessageData,
  deriveAgentThreadTitle,
} from '../memory/agent-memory-service';
import {
  buildIncompleteAgentReply,
  buildStoppedAgentReply,
  FAILED_AGENT_REPLY,
} from '../runner/agent-chat-fallback';
import {
  decideAgentTurnCancel,
  decideAgentTurnClaim,
  decideAgentTurnStart,
  MAX_AGENT_TURN_ATTEMPTS,
  type AgentTurnClaimDecision,
} from './agent-turn-decisions';
import {
  applyAgentTurnTerminalWrites,
  finalizeAgentTurn,
  type IAgentTurnTerminalState,
} from './agent-turn-finalize';
import {
  parseAgentTurnRecord,
  type AgentTurnRecord,
  type AgentTurnUsageKind,
} from './agent-turn-record';
import { enqueueAgentTurnTask } from './agent-turn-task-queue';

const STALE_TURN_MESSAGE =
  'The agent stopped responding before it finished this reply.';

/** Terminal state for a turn that died without finishing (keeps partial work). */
export function buildStaleTurnState(
  turn: AgentTurnRecord,
  status: 'failed' | 'cancelled',
): IAgentTurnTerminalState {
  const partial = turn.reply.trim();
  const hasActions = turn.executedActions.length > 0;
  let reply: string;
  if (partial.length > 0) {
    reply = partial;
  } else if (status === 'cancelled') {
    reply = buildStoppedAgentReply(turn.executedActions);
  } else {
    reply = hasActions
      ? buildIncompleteAgentReply(turn.executedActions)
      : FAILED_AGENT_REPLY;
  }
  return {
    status,
    incomplete: status === 'failed' && hasActions,
    reply,
    executedActions: turn.executedActions,
    proposedDeletes: turn.proposedDeletes,
    referencedItems: turn.referencedItems,
    error:
      status === 'failed' ? { code: 'stale', message: STALE_TURN_MESSAGE } : null,
  };
}

function isFreeStarterTurn(
  decision: StarterTurnDecision,
): decision is { type: 'begin' } | { type: 'continue' } {
  return decision.type === 'begin' || decision.type === 'continue';
}

function usageKindForScope(
  scope: StartAgentTurnInput['scope'],
): AgentTurnUsageKind {
  return scope === 'workspace' ? 'directoryAgent' : 'directoryScopedAgent';
}

type StartTransactionResult =
  | { type: 'created'; staleTurn: AgentTurnRecord | null }
  | { type: 'race'; turn: AgentTurnRecord | null };

/**
 * Starts a turn: reserves credits, then in one transaction writes the user
 * message, the queued turn doc and the thread's active turn, then enqueues the
 * worker task. Idempotent on (threadId, turnId).
 */
export async function startAgentTurn(
  userId: string,
  input: StartAgentTurnInput,
): Promise<StartAgentTurnResponse> {
  const { threadId, turnId } = input;
  const turnRef = FirestorePaths.agentThreadTurn(userId, threadId, turnId);
  const threadRef = FirestorePaths.agentThread(userId, threadId);

  const userMessageRef = FirestorePaths.agentThreadMessages(
    userId,
    threadId,
  ).doc(buildAgentUserMessageId(turnId));

  // The turn doc expires after 7 days, but its user message does not, so the
  // message also marks the (threadId, turnId) pair as used.
  const userRef = FirestorePaths.user(userId);
  const [existingSnap, existingMessageSnap, userSnap] =
    await turnRef.firestore.getAll(turnRef, userMessageRef, userRef);
  const existing = parseAgentTurnRecord(existingSnap.data());
  if (existing || existingMessageSnap.exists) {
    return {
      success: true,
      threadId,
      turnId,
      status: existing?.status ?? 'completed',
      alreadyStarted: true,
    };
  }

  // The free onboarding starter course: the server decides, the client only
  // states the intent.
  const starter = decideStarterTurn({
    onboarding: parseUserOnboarding(userSnap.get('onboarding')),
    threadId,
    intent: input.intent,
  });
  if (starter.type === 'reject') {
    throw new HttpsError('failed-precondition', starter.message, {
      code: STARTER_COURSE_UNAVAILABLE_CODE,
    });
  }
  const isStarterTurn = isFreeStarterTurn(starter);

  const usageKind = usageKindForScope(input.scope);
  const hold = await enforceCallableAgentLoopLimits(
    userId,
    usageKind,
    isStarterTurn ? { waiver: { reason: 'starter_course' } } : undefined,
  );
  const reservationId = hold.usageReservation.id;

  let result: StartTransactionResult;
  try {
    result = await turnRef.firestore.runTransaction(
      async (transaction): Promise<StartTransactionResult> => {
        const [threadSnap, turnSnap, userMessageSnap, txUserSnap] =
          await transaction.getAll(threadRef, turnRef, userMessageRef, userRef);
        if (turnSnap.exists || userMessageSnap.exists) {
          return { type: 'race', turn: parseAgentTurnRecord(turnSnap.data()) };
        }

        // Re-check the free allowance inside the transaction, so two turns
        // racing for the last free slot cannot both get it.
        const txOnboarding = parseUserOnboarding(txUserSnap.get('onboarding'));
        if (isStarterTurn) {
          const confirmed = decideStarterTurn({
            onboarding: txOnboarding,
            threadId,
            intent: input.intent,
          });
          if (confirmed.type !== starter.type || !txOnboarding) {
            throw new HttpsError(
              'aborted',
              'Your starter course changed while starting. Please try again.',
            );
          }
        }

        const activeTurnIdValue: unknown = threadSnap.get('activeTurnId');
        const activeTurnId =
          typeof activeTurnIdValue === 'string' && activeTurnIdValue.length > 0
            ? activeTurnIdValue
            : null;
        const activeTurn =
          activeTurnId && activeTurnId !== turnId
            ? parseAgentTurnRecord(
                (
                  await transaction.get(
                    FirestorePaths.agentThreadTurn(
                      userId,
                      threadId,
                      activeTurnId,
                    ),
                  )
                ).data(),
              )
            : null;

        const now = new Date();
        const decision = decideAgentTurnStart({
          turnId,
          activeTurnId,
          activeTurn,
          nowMs: now.getTime(),
        });
        if (decision.type === 'in-progress') {
          throw new HttpsError(
            'failed-precondition',
            'A reply is still in progress in this conversation.',
            {
              code: AGENT_TURN_IN_PROGRESS_CODE,
              activeTurnId: decision.activeTurnId,
            },
          );
        }
        if (decision.type === 'replace-stale') {
          applyAgentTurnTerminalWrites(transaction, {
            userId,
            threadId,
            turnId: decision.staleTurn.id,
            // The new turn takes over activeTurnId below.
            clearActiveTurn: false,
            state: buildStaleTurnState(decision.staleTurn, 'failed'),
            now,
          });
        }

        const nowTimestamp = Timestamp.fromDate(now);
        const userMessageId = userMessageRef.id;

        transaction.set(
          threadRef,
          {
            ...(threadSnap.exists
              ? {}
              : {
                  id: threadId,
                  userId,
                  scope: input.scope,
                  ...(input.directoryId
                    ? { directoryId: input.directoryId }
                    : {}),
                  title: deriveAgentThreadTitle(input.message),
                  createdAt: nowTimestamp,
                }),
            updatedAt: nowTimestamp,
            lastMessageAt: nowTimestamp,
            activeTurnId: turnId,
            activeTurnStartedAt: nowTimestamp,
          },
          { merge: true },
        );

        if (isStarterTurn && txOnboarding && isFreeStarterTurn(starter)) {
          transaction.set(
            userRef,
            {
              onboarding: serializeUserOnboarding(
                applyStarterTurn({
                  onboarding: txOnboarding,
                  decision: starter.type,
                  threadId,
                  subject: input.message,
                  nowIso: now.toISOString(),
                }),
              ),
              updatedAt: now.toISOString(),
            },
            { merge: true },
          );
        }

        transaction.set(
          userMessageRef,
          buildAgentThreadMessageData({
            role: 'user',
            content: input.message,
            createdAt: now,
            promptContext: input.promptContext,
            turnId,
          }),
        );

        transaction.create(turnRef, {
          id: turnId,
          threadId,
          userId,
          scope: input.scope,
          ...(input.directoryId ? { directoryId: input.directoryId } : {}),
          status: 'queued',
          incomplete: false,
          statusMessage: null,
          reply: '',
          replySeq: 0,
          executedActions: [],
          proposedDeletes: [],
          referencedItems: [],
          userMessageId,
          assistantMessageId: null,
          error: null,
          cancelRequested: false,
          attempt: 0,
          leaseId: null,
          request: {
            message: input.message,
            ...(input.promptContext
              ? { promptContext: input.promptContext }
              : {}),
            ...(input.clientLocalDate
              ? { clientLocalDate: input.clientLocalDate }
              : {}),
            ...(input.directoryId ? { directoryId: input.directoryId } : {}),
          },
          ...(isStarterTurn ? { starterCourse: true } : {}),
          usage: {
            usageKind,
            reservationId,
            loopBudgetCredits: hold.loopBudgetCredits,
            pricePerCreditCents: hold.pricePerCreditCents,
            periodKey: hold.usageReservation.periodKey,
          },
          createdAt: nowTimestamp,
          updatedAt: nowTimestamp,
        });

        return {
          type: 'created',
          staleTurn: decision.type === 'replace-stale' ? decision.staleTurn : null,
        };
      },
    );
  } catch (error) {
    await refundUsageReservationSafe(userId, reservationId);
    throw error;
  }

  if (result.type === 'race') {
    await refundUsageReservationSafe(userId, reservationId);
    return {
      success: true,
      threadId,
      turnId,
      status: result.turn?.status ?? 'completed',
      alreadyStarted: true,
    };
  }

  if (result.staleTurn) {
    await settleAgentLoopUsageReservationSafe(
      userId,
      result.staleTurn.usage.reservationId,
    );
  }

  try {
    await enqueueAgentTurnTask({ userId, threadId, turnId });
  } catch (error) {
    logger.error('Failed to enqueue agent turn task', {
      userId,
      threadId,
      turnId,
      error: error instanceof Error ? error.message : String(error),
    });
    // A rejected enqueue does not prove Cloud Tasks dropped the task: only
    // fail the turn if no worker has claimed it.
    const finalized = await finalizeAgentTurn({
      userId,
      threadId,
      turnId,
      guard: (turn) => turn.status === 'queued',
      state: {
        status: 'failed',
        incomplete: false,
        reply: FAILED_AGENT_REPLY,
        executedActions: [],
        proposedDeletes: [],
        referencedItems: [],
        error: { code: 'enqueue', message: 'Could not start the agent' },
      },
      settlement: 'refund',
    });
    if (finalized.didTransition) {
      throw new HttpsError(
        'unavailable',
        'Could not start the agent. Please try again.',
      );
    }
    // A worker already took the turn; report it as started.
    return {
      success: true,
      threadId,
      turnId,
      status: finalized.turn?.status ?? 'running',
      alreadyStarted: false,
    };
  }

  // Mark the task accepted, so the sweep can tell a turn waiting for a
  // dispatch slot from one whose task was never created.
  await turnRef
    .update({ enqueuedAt: FieldValue.serverTimestamp() })
    .catch((error: unknown) => {
      logger.warn('Failed to record agent turn enqueue', {
        userId,
        threadId,
        turnId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  return { success: true, threadId, turnId, status: 'queued', alreadyStarted: false };
}

/** Stop: finalizes a queued or dead turn now, or flags a live one for its worker. */
export async function cancelAgentTurn(
  userId: string,
  input: CancelAgentTurnRequest,
): Promise<CancelAgentTurnResponse> {
  const { threadId, turnId } = input;
  const turnRef = FirestorePaths.agentThreadTurn(userId, threadId, turnId);
  const turn = parseAgentTurnRecord((await turnRef.get()).data());
  if (!turn) {
    throw new HttpsError('not-found', 'Agent turn not found');
  }

  const decision = decideAgentTurnCancel(turn, Date.now());
  if (decision.type === 'noop') {
    return { success: true, status: turn.status };
  }

  if (decision.type === 'finalize') {
    const finalized = await finalizeAgentTurn({
      userId,
      threadId,
      turnId,
      // Re-decide on the transaction's snapshot: a worker may have claimed the
      // turn or sent a heartbeat since the read above.
      guard: (current) =>
        decideAgentTurnCancel(current, Date.now()).type === 'finalize',
      state: (current) => buildStaleTurnState(current, 'cancelled'),
      settlement: (current) =>
        current.status === 'queued' ? 'refund' : 'settle',
    });
    if (finalized.didTransition) {
      return { success: true, status: 'cancelled' };
    }
    if (!finalized.turn || finalized.turn.status !== 'running') {
      return { success: true, status: finalized.turn?.status ?? turn.status };
    }
  }

  // A live run: flag it; its worker polls the flag and stops within seconds.
  const status = await turnRef.firestore.runTransaction(async (transaction) => {
    const current = parseAgentTurnRecord((await transaction.get(turnRef)).data());
    if (!current || current.status !== 'running') {
      return current?.status ?? turn.status;
    }
    transaction.update(turnRef, {
      cancelRequested: true,
      cancelRequestedAt: FieldValue.serverTimestamp(),
    });
    return current.status;
  });
  return { success: true, status };
}

export type AgentTurnClaimResult =
  | {
      decision: Extract<AgentTurnClaimDecision, { type: 'claim' | 'reclaim' }>;
      turn: AgentTurnRecord;
      leaseId: string;
    }
  | {
      decision: Exclude<AgentTurnClaimDecision, { type: 'claim' | 'reclaim' }>;
      turn: AgentTurnRecord | null;
    };

/** Worker claim: takes the lease on a queued turn, or on a running turn after a retry. */
export async function claimAgentTurn(input: {
  userId: string;
  threadId: string;
  turnId: string;
  retryCount: number;
}): Promise<AgentTurnClaimResult> {
  const turnRef = FirestorePaths.agentThreadTurn(
    input.userId,
    input.threadId,
    input.turnId,
  );
  return turnRef.firestore.runTransaction(
    async (transaction): Promise<AgentTurnClaimResult> => {
      const turn = parseAgentTurnRecord((await transaction.get(turnRef)).data());
      const now = new Date();
      const decision = decideAgentTurnClaim({
        turn,
        retryCount: input.retryCount,
        nowMs: now.getTime(),
        maxAttempts: MAX_AGENT_TURN_ATTEMPTS,
      });
      if (decision.type !== 'claim' && decision.type !== 'reclaim') {
        return { decision, turn };
      }
      if (!turn) {
        return { decision: { type: 'skip', reason: 'missing' }, turn: null };
      }

      const leaseId = randomUUID();
      const nowTimestamp = Timestamp.fromDate(now);
      const attempt = turn.attempt + 1;
      transaction.update(turnRef, {
        status: 'running',
        attempt,
        leaseId,
        startedAt: turn.startedAt ?? nowTimestamp,
        heartbeatAt: nowTimestamp,
        updatedAt: nowTimestamp,
        statusMessage: decision.type === 'reclaim' ? 'Resuming...' : 'Starting...',
        // A retry restarts the reply stream; clients detect the reset via replySeq.
        ...(decision.type === 'reclaim'
          ? { reply: '', replySeq: FieldValue.increment(1) }
          : {}),
      });
      return {
        decision,
        turn: {
          ...turn,
          status: 'running',
          attempt,
          leaseId,
          ...(decision.type === 'reclaim' ? { reply: '' } : {}),
        },
        leaseId,
      };
    },
  );
}

/** Releases the worker's lease before a Cloud Tasks retry takes over the turn. */
export async function releaseAgentTurnLease(input: {
  userId: string;
  threadId: string;
  turnId: string;
  leaseId: string;
}): Promise<void> {
  const turnRef = FirestorePaths.agentThreadTurn(
    input.userId,
    input.threadId,
    input.turnId,
  );
  await turnRef.firestore.runTransaction(async (transaction) => {
    const turn = parseAgentTurnRecord((await transaction.get(turnRef)).data());
    if (!turn || turn.leaseId !== input.leaseId || turn.status !== 'running') {
      return;
    }
    // Keep the heartbeat so the stale sweep leaves the turn to the retry.
    transaction.update(turnRef, {
      leaseId: null,
      statusMessage: 'Retrying...',
      updatedAt: Timestamp.now(),
    });
  });
}
