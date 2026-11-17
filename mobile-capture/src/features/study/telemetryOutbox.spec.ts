import { describe, expect, it, vi } from 'vitest';
import {
  createTelemetryOutbox,
  OUTBOX_MAX_ATTEMPTS,
  type IOutboxSenders,
} from './telemetryOutbox';

function memoryStorage() {
  let value: string | undefined;
  return {
    read: () => value,
    write: (next: string) => {
      value = next;
    },
  };
}

function senders(overrides: Partial<IOutboxSenders> = {}): IOutboxSenders {
  return {
    quizAttempt: vi.fn().mockResolvedValue('attempt-1'),
    flashcardSession: vi.fn().mockResolvedValue('session-1'),
    learnedVocabulary: vi.fn().mockResolvedValue({ id: 'v', created: true }),
    ...overrides,
  };
}

const session = {
  kind: 'flashcardSession' as const,
  userId: 'user-1',
  request: {
    flashcardSetId: 'set-1',
    startedAt: '2026-11-16T10:00:00.000Z',
    completedAt: '2026-11-16T10:05:00.000Z',
    cards: [{ cardId: 'c1', outcome: 'failed' as const }],
  },
};

describe('telemetry outbox', () => {
  it('sends immediately when online and empties the queue', async () => {
    const send = senders();
    const outbox = createTelemetryOutbox({
      storage: memoryStorage(),
      senders: send,
      isOnline: () => true,
    });

    await outbox.enqueue(session);

    expect(send.flashcardSession).toHaveBeenCalledWith(
      'user-1',
      session.request,
    );
    expect(outbox.pending()).toEqual([]);
  });

  it('keeps entries while offline and sends them on the next flush', async () => {
    let online = false;
    const send = senders();
    const outbox = createTelemetryOutbox({
      storage: memoryStorage(),
      senders: send,
      isOnline: () => online,
    });

    await outbox.enqueue(session);
    expect(send.flashcardSession).not.toHaveBeenCalled();
    expect(outbox.pending()).toHaveLength(1);

    online = true;
    await expect(outbox.flush()).resolves.toEqual({ sent: 1, remaining: 0 });
  });

  it('retries failures and drops an entry after the max attempts', async () => {
    const send = senders({
      quizAttempt: vi.fn().mockRejectedValue(new Error('quiz deleted')),
    });
    const outbox = createTelemetryOutbox({
      storage: memoryStorage(),
      senders: send,
      isOnline: () => true,
    });

    await outbox.enqueue({
      kind: 'quizAttempt',
      userId: 'user-1',
      request: {
        quizId: 'q1',
        quizType: 'quiz',
        startedAt: '2026-11-16T10:00:00.000Z',
        completedAt: '2026-11-16T10:01:00.000Z',
        durationMs: 60_000,
        answers: [{ questionIndex: 0, selectedAnswer: 2 }],
      },
    });
    expect(outbox.pending()[0]?.attempts).toBe(1);

    for (let attempt = 1; attempt < OUTBOX_MAX_ATTEMPTS; attempt += 1) {
      await outbox.flush();
    }
    expect(outbox.pending()).toEqual([]);
  });

  it("leaves another account's entries untouched until that account signs in again", async () => {
    let currentUser = 'user-2';
    const send = senders();
    const outbox = createTelemetryOutbox({
      storage: memoryStorage(),
      senders: send,
      isOnline: () => true,
      canSend: (entry) => entry.userId === currentUser,
    });

    await outbox.enqueue(session);
    expect(send.flashcardSession).not.toHaveBeenCalled();
    expect(outbox.pending()[0]?.attempts).toBe(0);

    currentUser = 'user-1';
    await expect(outbox.flush()).resolves.toEqual({ sent: 1, remaining: 0 });
  });

  it('ignores corrupt storage instead of crashing', () => {
    const outbox = createTelemetryOutbox({
      storage: { read: () => '{not json', write: () => undefined },
      senders: senders(),
      isOnline: () => true,
    });
    expect(outbox.pending()).toEqual([]);
  });
});
