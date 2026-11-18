import { Timestamp } from 'firebase-admin/firestore';
import type { AgentTurnRecord } from './agent-turn-record';

export const TURN_FIXTURE_NOW_MS = Date.UTC(2026, 10, 18, 12, 0, 0);

/** Test-only turn record; timestamps default to TURN_FIXTURE_NOW_MS. */
export function makeAgentTurnRecord(
  overrides: Partial<AgentTurnRecord> = {},
): AgentTurnRecord {
  const now = Timestamp.fromMillis(TURN_FIXTURE_NOW_MS);
  return {
    id: 'turn-0001',
    threadId: 'thread-0001',
    userId: 'user-1',
    scope: 'workspace',
    status: 'queued',
    incomplete: false,
    statusMessage: null,
    reply: '',
    replySeq: 0,
    executedActions: [],
    proposedDeletes: [],
    referencedItems: [],
    userMessageId: 'user-turn-0001',
    assistantMessageId: null,
    error: null,
    cancelRequested: false,
    attempt: 0,
    leaseId: null,
    request: { message: 'Make me a quiz' },
    usage: {
      usageKind: 'directoryAgent',
      reservationId: 'reservation-1',
      loopBudgetCredits: 50,
      pricePerCreditCents: 1,
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function msAgo(ms: number): Timestamp {
  return Timestamp.fromMillis(TURN_FIXTURE_NOW_MS - ms);
}
