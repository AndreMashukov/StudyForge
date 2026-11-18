import { describe, expect, it } from 'vitest';
import {
  createAgentTurnSseCursor,
  diffAgentTurnToStreamEvents,
} from './agent-turn-sse-bridge';
import { makeAgentTurnRecord } from './agent-turn-test-fixtures';

describe('diffAgentTurnToStreamEvents', () => {
  it('sends status changes once and reply text as suffix deltas', () => {
    const cursor = createAgentTurnSseCursor();
    const first = diffAgentTurnToStreamEvents(
      cursor,
      makeAgentTurnRecord({
        status: 'running',
        statusMessage: 'Planning...',
        reply: 'Hello',
      }),
    );
    expect(first.events).toEqual([
      { type: 'status', message: 'Planning...' },
      { type: 'delta', text: 'Hello' },
    ]);
    expect(first.done).toBe(false);

    const second = diffAgentTurnToStreamEvents(
      cursor,
      makeAgentTurnRecord({
        status: 'running',
        statusMessage: 'Planning...',
        reply: 'Hello world',
      }),
    );
    expect(second.events).toEqual([{ type: 'delta', text: ' world' }]);
  });

  it('sends no deltas after a reply reset', () => {
    const cursor = createAgentTurnSseCursor();
    diffAgentTurnToStreamEvents(
      cursor,
      makeAgentTurnRecord({ status: 'running', reply: 'First attempt' }),
    );
    const reset = diffAgentTurnToStreamEvents(
      cursor,
      makeAgentTurnRecord({ status: 'running', reply: 'Second try, longer text' }),
    );
    expect(reset.events).toEqual([]);
  });

  it('sends each action and card once', () => {
    const cursor = createAgentTurnSseCursor();
    const turn = makeAgentTurnRecord({
      status: 'running',
      executedActions: [
        { kind: 'create_directory', summary: 'Created /Research', entityId: 'dir-1' },
      ],
      referencedItems: [{ itemType: 'directory', id: 'dir-1', title: 'Research' }],
    });
    expect(diffAgentTurnToStreamEvents(cursor, turn).events).toHaveLength(2);
    expect(diffAgentTurnToStreamEvents(cursor, turn).events).toEqual([]);
  });

  it('ends with done carrying the final reply', () => {
    const cursor = createAgentTurnSseCursor();
    diffAgentTurnToStreamEvents(
      cursor,
      makeAgentTurnRecord({ status: 'running', reply: 'Draft' }),
    );
    const result = diffAgentTurnToStreamEvents(
      cursor,
      makeAgentTurnRecord({
        status: 'completed',
        reply: 'Final answer',
        evalRetrievedTexts: ['policy'],
      }),
    );
    expect(result.done).toBe(true);
    expect(result.events).toEqual([
      {
        type: 'done',
        response: {
          reply: 'Final answer',
          threadId: 'thread-0001',
          executedActions: [],
          proposedDeletes: [],
          referencedItems: [],
          retrievedTexts: ['policy'],
        },
      },
    ]);
  });
});
