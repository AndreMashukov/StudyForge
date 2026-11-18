import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IAgentThread, IAgentThreadMessage } from '@shared-types';
import { createAgentThreadMessageSync } from './agentThreadMessageSync';

function thread(lastMessageAt: string): IAgentThread {
  return {
    id: 'thread-1',
    userId: 'user-1',
    scope: 'workspace',
    createdAt: '2026-11-18T12:00:00.000Z',
    updatedAt: lastMessageAt,
    lastMessageAt,
  };
}

function message(id: string): IAgentThreadMessage {
  return {
    id,
    threadId: 'thread-1',
    role: 'assistant',
    content: id,
    createdAt: '2026-11-18T12:00:00.000Z',
  };
}

describe('createAgentThreadMessageSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads on the first snapshot, then only when lastMessageAt moves', async () => {
    const loadMessages = vi.fn(async () => [message('m1')]);
    const onMessages = vi.fn();
    const sync = createAgentThreadMessageSync({
      userId: 'user-1',
      threadId: 'thread-1',
      onMessages,
      loadMessages,
    });

    sync.onThread(thread('t1'));
    await vi.runAllTimersAsync();
    sync.onThread(thread('t1'));
    await vi.runAllTimersAsync();
    expect(loadMessages).toHaveBeenCalledTimes(1);

    sync.onThread(thread('t2'));
    await vi.runAllTimersAsync();
    expect(loadMessages).toHaveBeenCalledTimes(2);
    expect(onMessages).toHaveBeenCalledTimes(2);
  });

  it('retries a failed read with backoff and keeps it due', async () => {
    const loadMessages = vi
      .fn<() => Promise<IAgentThreadMessage[]>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([message('reply')]);
    const onMessages = vi.fn();
    const sync = createAgentThreadMessageSync({
      userId: 'user-1',
      threadId: 'thread-1',
      onMessages,
      loadMessages,
      retryBaseMs: 100,
    });

    sync.onThread(thread('t1'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onMessages).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(onMessages).toHaveBeenCalledWith([message('reply')]);
  });

  it('stays due after giving up, so the next snapshot reads again', async () => {
    const loadMessages = vi
      .fn<() => Promise<IAgentThreadMessage[]>>()
      .mockRejectedValue(new Error('offline'));
    const sync = createAgentThreadMessageSync({
      userId: 'user-1',
      threadId: 'thread-1',
      onMessages: vi.fn(),
      loadMessages,
      maxRetries: 1,
      retryBaseMs: 10,
    });

    sync.onThread(thread('t1'));
    await vi.runAllTimersAsync();
    expect(loadMessages).toHaveBeenCalledTimes(2);

    sync.onThread(thread('t1'));
    await vi.runAllTimersAsync();
    expect(loadMessages).toHaveBeenCalledTimes(4);
  });

  it('discards a slower, superseded read', async () => {
    let resolveOld: (messages: IAgentThreadMessage[]) => void = () => undefined;
    const loadMessages = vi
      .fn<() => Promise<IAgentThreadMessage[]>>()
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveOld = resolve)),
      )
      .mockResolvedValueOnce([message('new')]);
    const onMessages = vi.fn();
    const sync = createAgentThreadMessageSync({
      userId: 'user-1',
      threadId: 'thread-1',
      onMessages,
      loadMessages,
    });

    sync.onThread(thread('t1'));
    sync.onThread(thread('t2'));
    await vi.advanceTimersByTimeAsync(0);
    resolveOld([message('old')]);
    await vi.advanceTimersByTimeAsync(0);

    expect(onMessages).toHaveBeenCalledTimes(1);
    expect(onMessages).toHaveBeenCalledWith([message('new')]);
  });

  it('ignores results after dispose', async () => {
    const onMessages = vi.fn();
    const sync = createAgentThreadMessageSync({
      userId: 'user-1',
      threadId: 'thread-1',
      onMessages,
      loadMessages: async () => [message('m1')],
    });
    sync.onThread(thread('t1'));
    sync.dispose();
    await vi.runAllTimersAsync();
    expect(onMessages).not.toHaveBeenCalled();
  });
});
