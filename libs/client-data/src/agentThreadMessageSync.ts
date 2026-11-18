import type { IAgentThread, IAgentThreadMessage } from '@shared-types';
import { listAgentThreadMessages } from './agentThreadFirestore';

export interface IAgentThreadMessageSync {
  /** Call with every server-confirmed thread snapshot. */
  onThread: (thread: IAgentThread) => void;
  dispose: () => void;
}

export interface IAgentThreadMessageSyncOptions {
  userId: string;
  threadId: string;
  onMessages: (messages: IAgentThreadMessage[]) => void;
  /** Injectable for tests; defaults to a server read of the newest messages. */
  loadMessages?: () => Promise<IAgentThreadMessage[]>;
  maxRetries?: number;
  retryBaseMs?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 1_000;

/** No read in flight or scheduled. */
const IDLE = Symbol('idle');

/**
 * Keeps a thread's message list in step with its thread doc. Messages are
 * re-read from the server whenever `lastMessageAt` differs from the last
 * successful read:
 * - the first server-confirmed snapshot always reads (the cached list may be
 *   older than the thread);
 * - a failed read retries with backoff and stays due for the next snapshot;
 * - a read superseded by a newer one is discarded.
 */
export function createAgentThreadMessageSync(
  options: IAgentThreadMessageSyncOptions,
): IAgentThreadMessageSync {
  const loadMessages =
    options.loadMessages ??
    (() =>
      listAgentThreadMessages(options.userId, options.threadId, {
        fromServer: true,
      }));
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryBaseMs = options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;

  let synced: { lastMessageAt: string | null } | null = null;
  let pendingFor: string | null | typeof IDLE = IDLE;
  let requestSeq = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const clearRetry = (): void => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const request = (lastMessageAt: string | null, attempt: number): void => {
    clearRetry();
    const seq = ++requestSeq;
    pendingFor = lastMessageAt;
    loadMessages().then(
      (messages) => {
        if (disposed || seq !== requestSeq) {
          return;
        }
        synced = { lastMessageAt };
        pendingFor = IDLE;
        options.onMessages(messages);
      },
      () => {
        if (disposed || seq !== requestSeq) {
          return;
        }
        if (attempt >= maxRetries) {
          // Give up for now; the next thread snapshot makes it due again.
          pendingFor = IDLE;
          return;
        }
        retryTimer = setTimeout(
          () => request(lastMessageAt, attempt + 1),
          retryBaseMs * 2 ** attempt,
        );
      },
    );
  };

  return {
    onThread: (thread) => {
      if (disposed) {
        return;
      }
      const lastMessageAt = thread.lastMessageAt ?? null;
      if (synced && synced.lastMessageAt === lastMessageAt) {
        return;
      }
      if (pendingFor !== IDLE && pendingFor === lastMessageAt) {
        return;
      }
      request(lastMessageAt, 0);
    },
    dispose: () => {
      disposed = true;
      clearRetry();
    },
  };
}
