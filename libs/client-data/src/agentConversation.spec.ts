import { describe, expect, it } from 'vitest';
import type { AgentTurn, IAgentThreadMessage } from '@shared-types';
import {
  isAgentTurnStuck,
  mergeAgentConversation,
  nextRevealLength,
} from './agentConversation';

const NOW = Date.parse('2026-11-18T12:00:00.000Z');

function isoAgo(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

function makeTurn(overrides: Partial<AgentTurn> = {}): AgentTurn {
  return {
    id: 'turn-0001',
    threadId: 'thread-0001',
    scope: 'workspace',
    status: 'running',
    incomplete: false,
    statusMessage: 'Planning...',
    reply: 'Partial',
    replySeq: 2,
    executedActions: [],
    proposedDeletes: [],
    referencedItems: [],
    userMessageId: 'user-turn-0001',
    assistantMessageId: null,
    error: null,
    cancelRequested: false,
    attempt: 1,
    createdAt: isoAgo(10_000),
    updatedAt: isoAgo(1_000),
    heartbeatAt: isoAgo(1_000),
    ...overrides,
  };
}

const userMessage: IAgentThreadMessage = {
  id: 'user-turn-0001',
  threadId: 'thread-0001',
  role: 'user',
  content: 'Make a quiz',
  createdAt: isoAgo(10_000),
  turnId: 'turn-0001',
};

describe('mergeAgentConversation', () => {
  it('renders a running turn as a live bubble after its user message', () => {
    const entries = mergeAgentConversation({
      messages: [userMessage],
      turn: makeTurn(),
      pendingUser: null,
      nowMs: NOW,
    });
    expect(entries.map((entry) => entry.id)).toEqual([
      'user-turn-0001',
      'assistant-turn-0001',
    ]);
    expect(entries[1].content).toBe('Partial');
    expect(entries[1].live).toEqual({
      status: 'running',
      statusMessage: 'Planning...',
      cancelRequested: false,
      stuck: false,
    });
  });

  it('prefers the stored assistant message once it exists', () => {
    const entries = mergeAgentConversation({
      messages: [
        userMessage,
        {
          id: 'assistant-turn-0001',
          threadId: 'thread-0001',
          role: 'assistant',
          content: 'Final',
          createdAt: isoAgo(0),
          turnId: 'turn-0001',
          turnStatus: 'completed',
        },
      ],
      turn: makeTurn({ status: 'completed', reply: 'Final' }),
      pendingUser: null,
      nowMs: NOW,
    });
    expect(entries).toHaveLength(2);
    expect(entries[1].live).toBeUndefined();
    expect(entries[1].turnStatus).toBe('completed');
  });

  it('renders a finished turn from the turn doc until messages are refetched', () => {
    const entries = mergeAgentConversation({
      messages: [userMessage],
      turn: makeTurn({ status: 'cancelled', reply: 'Stopped.' }),
      pendingUser: null,
      nowMs: NOW,
    });
    expect(entries[1].content).toBe('Stopped.');
    expect(entries[1].turnStatus).toBe('cancelled');
    expect(entries[1].live).toBeUndefined();
  });

  it('shows an optimistic user message and bubble while start is in flight', () => {
    const entries = mergeAgentConversation({
      messages: [],
      turn: null,
      pendingUser: {
        turnId: 'turn-0002',
        content: 'Hello',
        createdAt: isoAgo(0),
      },
      nowMs: NOW,
    });
    expect(entries.map((entry) => [entry.id, entry.pending === true])).toEqual([
      ['user-turn-0002', true],
      ['assistant-turn-0002', false],
    ]);
    expect(entries[1].live?.status).toBe('queued');
  });

  it('drops the optimistic message once the stored one arrives', () => {
    const entries = mergeAgentConversation({
      messages: [userMessage],
      turn: makeTurn(),
      pendingUser: {
        turnId: 'turn-0001',
        content: 'Make a quiz',
        createdAt: isoAgo(10_000),
      },
      nowMs: NOW,
    });
    expect(entries.filter((entry) => entry.role === 'user')).toHaveLength(1);
    expect(entries[0].pending).toBeUndefined();
  });
});

describe('isAgentTurnStuck', () => {
  it('flags a running turn with no heartbeat for over 90s', () => {
    expect(isAgentTurnStuck(makeTurn({ heartbeatAt: isoAgo(91_000) }), NOW)).toBe(
      true,
    );
    expect(isAgentTurnStuck(makeTurn(), NOW)).toBe(false);
  });

  it('flags a queued turn not picked up for over 2 minutes', () => {
    expect(
      isAgentTurnStuck(
        makeTurn({ status: 'queued', createdAt: isoAgo(121_000) }),
        NOW,
      ),
    ).toBe(true);
  });

  it('never flags a finished turn', () => {
    expect(
      isAgentTurnStuck(
        makeTurn({ status: 'completed', heartbeatAt: isoAgo(600_000) }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe('nextRevealLength', () => {
  it('reveals proportionally and catches up within one flush interval', () => {
    expect(
      nextRevealLength({ displayedLength: 0, targetLength: 800, elapsedMs: 16 }),
    ).toBe(16);
    expect(
      nextRevealLength({ displayedLength: 0, targetLength: 800, elapsedMs: 800 }),
    ).toBe(800);
  });

  it('always moves at least one character and never overshoots', () => {
    expect(
      nextRevealLength({ displayedLength: 9, targetLength: 10, elapsedMs: 1 }),
    ).toBe(10);
  });

  it('snaps when the target shrinks (reply reset)', () => {
    expect(
      nextRevealLength({ displayedLength: 50, targetLength: 5, elapsedMs: 16 }),
    ).toBe(5);
  });
});
