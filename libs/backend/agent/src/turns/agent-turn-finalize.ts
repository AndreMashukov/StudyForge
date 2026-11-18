import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import type {
  AgentActionResult,
  AgentMessageTurnStatus,
  AgentProposedDelete,
  AgentReferencedItem,
  AgentTurnError,
  AgentTurnStatus,
} from '@shared-types';
import {
  buildAgentAssistantMessageId,
  isAgentTurnTerminal,
} from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { computeExpiresAt } from '@study-forge/backend-core/lib/firestore-ttl';
import {
  refundUsageReservationSafe,
  settleAgentLoopUsageReservationSafe,
} from '@study-forge/backend-generation/generation-limits';
import {
  AgentMemoryService,
  buildAgentThreadMessageData,
  deriveAgentThreadPreview,
} from '../memory/agent-memory-service';
import {
  parseAgentTurnRecord,
  serializeAgentActions,
  serializeAgentDeletes,
  serializeAgentReferences,
  type AgentTurnRecord,
} from './agent-turn-record';

export type AgentTurnTerminalStatus = Extract<
  AgentTurnStatus,
  'completed' | 'failed' | 'cancelled'
>;

export interface IAgentTurnTerminalState {
  status: AgentTurnTerminalStatus;
  /** Completed, but cut short (deadline, or an error after actions ran). */
  incomplete: boolean;
  reply: string;
  executedActions: AgentActionResult[];
  proposedDeletes: AgentProposedDelete[];
  referencedItems: AgentReferencedItem[];
  error: AgentTurnError | null;
  evalRetrievedTexts?: string[];
}

export function toMessageTurnStatus(
  state: Pick<IAgentTurnTerminalState, 'status' | 'incomplete'>,
): AgentMessageTurnStatus {
  if (state.status === 'completed') {
    return state.incomplete ? 'incomplete' : 'completed';
  }
  return state.status;
}

/**
 * Writes a turn's terminal state inside a transaction: the one assistant
 * message every finished turn writes, the turn doc, and the thread (preview,
 * active turn cleared). Every read must already have happened.
 */
export function applyAgentTurnTerminalWrites(
  transaction: Transaction,
  input: {
    userId: string;
    threadId: string;
    turnId: string;
    clearActiveTurn: boolean;
    state: IAgentTurnTerminalState;
    now: Date;
  },
): void {
  const { userId, threadId, turnId, state, now } = input;
  const nowTimestamp = Timestamp.fromDate(now);
  const assistantMessageId = buildAgentAssistantMessageId(turnId);
  const messageStatus = toMessageTurnStatus(state);

  transaction.set(
    FirestorePaths.agentThreadMessages(userId, threadId).doc(
      assistantMessageId,
    ),
    buildAgentThreadMessageData({
      role: 'assistant',
      content: state.reply,
      createdAt: now,
      executedActions: state.executedActions,
      proposedDeletes: state.proposedDeletes,
      referencedItems: state.referencedItems,
      turnId,
      turnStatus: messageStatus,
    }),
  );

  const preview = deriveAgentThreadPreview(state.reply);
  transaction.set(
    FirestorePaths.agentThread(userId, threadId),
    {
      updatedAt: nowTimestamp,
      lastMessageAt: nowTimestamp,
      ...(preview ? { preview } : {}),
      ...(input.clearActiveTurn
        ? { activeTurnId: null, activeTurnStartedAt: null }
        : {}),
    },
    { merge: true },
  );

  transaction.update(FirestorePaths.agentThreadTurn(userId, threadId, turnId), {
    status: state.status,
    incomplete: state.incomplete,
    reply: state.reply,
    executedActions: serializeAgentActions(state.executedActions),
    proposedDeletes: serializeAgentDeletes(state.proposedDeletes),
    referencedItems: serializeAgentReferences(state.referencedItems),
    assistantMessageId,
    error: state.error,
    statusMessage: null,
    leaseId: null,
    updatedAt: nowTimestamp,
    completedAt: nowTimestamp,
    expiresAt: computeExpiresAt(now, 'agentTurn'),
    ...(state.evalRetrievedTexts
      ? { evalRetrievedTexts: state.evalRetrievedTexts }
      : {}),
  });
}

export interface IFinalizeAgentTurnInput {
  userId: string;
  threadId: string;
  turnId: string;
  state: IAgentTurnTerminalState;
  /**
   * Only finalize when this still holds for the stored turn (for example, the
   * worker's lease still matches). Terminal turns are never finalized again.
   */
  guard?: (turn: AgentTurnRecord) => boolean;
  /** 'refund' when no LLM work ran (cancelled while queued, enqueue failure). */
  settlement: 'settle' | 'refund';
  /** Capture conversation memories (completed turns, inside the cost context). */
  captureMemories?: boolean;
}

export interface IFinalizeAgentTurnResult {
  didTransition: boolean;
  turn: AgentTurnRecord | null;
}

/**
 * Moves a turn to its terminal state exactly once. Whoever makes the
 * transition settles (or refunds) the turn's credit reservation.
 */
export async function finalizeAgentTurn(
  input: IFinalizeAgentTurnInput,
): Promise<IFinalizeAgentTurnResult> {
  const { userId, threadId, turnId } = input;
  const turnRef = FirestorePaths.agentThreadTurn(userId, threadId, turnId);
  const threadRef = FirestorePaths.agentThread(userId, threadId);

  const result = await turnRef.firestore.runTransaction(async (transaction) => {
    const [turnSnap, threadSnap] = await transaction.getAll(turnRef, threadRef);
    const turn = parseAgentTurnRecord(turnSnap.data());
    if (!turn) {
      return { didTransition: false, turn: null };
    }
    if (isAgentTurnTerminal(turn.status)) {
      return { didTransition: false, turn };
    }
    if (input.guard && !input.guard(turn)) {
      return { didTransition: false, turn };
    }

    applyAgentTurnTerminalWrites(transaction, {
      userId,
      threadId,
      turnId,
      clearActiveTurn: threadSnap.get('activeTurnId') === turnId,
      state: input.state,
      now: new Date(),
    });
    return { didTransition: true, turn };
  });

  if (!result.didTransition || !result.turn) {
    return result;
  }

  const turn = result.turn;
  if (input.captureMemories && input.state.status === 'completed') {
    await AgentMemoryService.captureTurnMemories({
      userId,
      threadId,
      userMessage: turn.request.message,
      assistantReply: input.state.reply,
    }).catch((error: unknown) => {
      logger.warn('Agent turn memory capture failed', {
        userId,
        threadId,
        turnId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  if (input.settlement === 'refund') {
    await refundUsageReservationSafe(userId, turn.usage.reservationId);
  } else {
    await settleAgentLoopUsageReservationSafe(userId, turn.usage.reservationId);
  }

  return result;
}
