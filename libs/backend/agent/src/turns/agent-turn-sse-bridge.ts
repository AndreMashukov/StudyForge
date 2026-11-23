import type { AgentMessageStreamEvent } from '@shared-types';
import { isAgentTurnTerminal } from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { buildAgentResponse } from '../memory/agent-memory-service';
import {
  agentActionKey,
  agentDeleteKey,
  agentReferenceKey,
  parseAgentTurnRecord,
  type AgentTurnRecord,
} from './agent-turn-record';

/** What the bridge has already sent to its client. */
export interface IAgentTurnSseCursor {
  sentReply: string;
  sentStatus: string | null;
  sentActionKeys: Set<string>;
  sentDeleteKeys: Set<string>;
  sentReferenceKeys: Set<string>;
}

export function createAgentTurnSseCursor(): IAgentTurnSseCursor {
  return {
    sentReply: '',
    sentStatus: null,
    sentActionKeys: new Set(),
    sentDeleteKeys: new Set(),
    sentReferenceKeys: new Set(),
  };
}

/**
 * Turns one turn-doc snapshot into the legacy SSE events the client has not
 * seen yet. Reply text goes out as suffix deltas; a reset (retry) sends no
 * deltas, and the terminal `done` carries the final reply either way.
 */
export function diffAgentTurnToStreamEvents(
  cursor: IAgentTurnSseCursor,
  turn: AgentTurnRecord,
): { events: AgentMessageStreamEvent[]; done: boolean } {
  const events: AgentMessageStreamEvent[] = [];
  const terminal = isAgentTurnTerminal(turn.status);

  if (
    !terminal &&
    turn.statusMessage &&
    turn.statusMessage !== cursor.sentStatus
  ) {
    cursor.sentStatus = turn.statusMessage;
    events.push({ type: 'status', message: turn.statusMessage });
  }

  if (!terminal && turn.reply.length > cursor.sentReply.length) {
    if (turn.reply.startsWith(cursor.sentReply)) {
      events.push({
        type: 'delta',
        text: turn.reply.slice(cursor.sentReply.length),
      });
      cursor.sentReply = turn.reply;
    }
  }

  for (const action of turn.executedActions) {
    const key = agentActionKey(action);
    if (!cursor.sentActionKeys.has(key)) {
      cursor.sentActionKeys.add(key);
      events.push({ type: 'action', action });
    }
  }
  for (const proposal of turn.proposedDeletes) {
    const key = agentDeleteKey(proposal);
    if (!cursor.sentDeleteKeys.has(key)) {
      cursor.sentDeleteKeys.add(key);
      events.push({ type: 'delete_proposal', proposal });
    }
  }
  for (const item of turn.referencedItems) {
    const key = agentReferenceKey(item);
    if (!cursor.sentReferenceKeys.has(key)) {
      cursor.sentReferenceKeys.add(key);
      events.push({ type: 'reference', item });
    }
  }

  if (terminal) {
    events.push({
      type: 'done',
      response: buildAgentResponse({
        reply: turn.reply,
        threadId: turn.threadId,
        executedActions: turn.executedActions,
        proposedDeletes: turn.proposedDeletes,
        referencedItems: turn.referencedItems,
        questions: turn.questions,
        ...(turn.evalRetrievedTexts
          ? { retrievedTexts: turn.evalRetrievedTexts }
          : {}),
      }),
    });
  }

  return { events, done: terminal };
}

export type AgentTurnSseTailEnd = 'done' | 'closed' | 'timeout' | 'missing';

/**
 * Tails a turn doc and forwards it as legacy SSE events until the turn ends,
 * the client goes away, or `maxDurationMs` passes. Closing only stops the
 * tail; the turn itself keeps running in its worker.
 */
export function tailAgentTurnAsSse(input: {
  userId: string;
  threadId: string;
  turnId: string;
  write: (event: AgentMessageStreamEvent) => void;
  signal: AbortSignal;
  maxDurationMs: number;
}): Promise<AgentTurnSseTailEnd> {
  const turnRef = FirestorePaths.agentThreadTurn(
    input.userId,
    input.threadId,
    input.turnId,
  );
  const cursor = createAgentTurnSseCursor();

  return new Promise<AgentTurnSseTailEnd>((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (end: AgentTurnSseTailEnd): void => {
      if (settled) {
        return;
      }
      settled = true;
      unsubscribe?.();
      if (timer) {
        clearTimeout(timer);
      }
      input.signal.removeEventListener('abort', onAbort);
      resolve(end);
    };
    const onAbort = (): void => finish('closed');

    if (input.signal.aborted) {
      finish('closed');
      return;
    }
    input.signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finish('timeout'), input.maxDurationMs);

    unsubscribe = turnRef.onSnapshot(
      (snapshot) => {
        if (settled) {
          return;
        }
        const turn = parseAgentTurnRecord(snapshot.data());
        if (!turn) {
          finish('missing');
          return;
        }
        const { events, done } = diffAgentTurnToStreamEvents(cursor, turn);
        for (const event of events) {
          input.write(event);
        }
        if (done) {
          finish('done');
        }
      },
      () => finish('closed'),
    );
  });
}
