import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AgentPromptContext,
  AgentScope,
  AgentThreadSummary,
  AgentTurn,
  GetAgentThreadResponse,
  IAgentThread,
} from '@shared-types';
import { isAgentTurnTerminal } from '@shared-types';
import {
  getAgentThreadFromFirestore,
  listAgentThreadsFromFirestore,
  subscribeDirectoryAgentThreads,
} from '@studyforge/client-data/agentThreadFirestore';
import { createAgentThreadMessageSync } from '@studyforge/client-data/agentThreadMessageSync';
import {
  getAgentTurnFromFirestore,
  subscribeAgentThread,
  subscribeAgentTurn,
} from '@studyforge/client-data/agentTurnFirestore';
import {
  findOpenAgentQuestions,
  isAgentTurnActive,
  mergeAgentConversation,
} from '@studyforge/client-data/agentConversation';
import {
  cancelAgentTurn,
  getCallableErrorMessage,
  isLimitError,
  LIMIT_MESSAGE,
  startAgentTurn,
} from '../../lib/api/studyforgeApi';
import { queryKeys } from '../../lib/api/queryKeys';
import { fromConversationEntry, type IChatMessage } from './agentEvents';

export interface IAgentChatScope {
  scope: AgentScope;
  directoryId?: string;
  promptContext?: AgentPromptContext;
}

interface IPendingTurn {
  threadId: string;
  turnId: string;
  content: string;
  createdAt: string;
  promptContext?: AgentPromptContext;
  /** startAgentTurn returned; the turn doc exists. */
  started: boolean;
}

const STUCK_CHECK_INTERVAL_MS = 5_000;

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAgentThreads(userId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: [...queryKeys.agentThreads(userId ?? ''), limit],
    enabled: Boolean(userId),
    queryFn: () => {
      if (!userId) throw new Error('Sign in to see chats');
      return listAgentThreadsFromFirestore(userId, limit);
    },
  });
}

/**
 * Chats started in a folder (their home folder), newest message first, kept
 * live while the screen is focused.
 */
export function useDirectoryAgentThreads(
  userId: string | undefined,
  directoryId: string | null,
  active: boolean,
) {
  const client = useQueryClient();
  const result = useQuery({
    queryKey: queryKeys.directoryAgentThreads(userId ?? '', directoryId ?? ''),
    enabled: Boolean(userId && directoryId && active),
    queryFn: () => {
      if (!userId || !directoryId) throw new Error('Directory unavailable');
      return new Promise<AgentThreadSummary[]>((resolve, reject) => {
        const unsubscribe = subscribeDirectoryAgentThreads(userId, directoryId, {
          onThreads: (threads) => {
            unsubscribe();
            resolve(threads);
          },
          onError: (error) => {
            unsubscribe();
            reject(error);
          },
        });
      });
    },
  });
  useEffect(() => {
    if (!userId || !directoryId || !active) return;
    return subscribeDirectoryAgentThreads(userId, directoryId, {
      onThreads: (threads) =>
        client.setQueryData(
          queryKeys.directoryAgentThreads(userId, directoryId),
          threads,
        ),
    });
  }, [userId, directoryId, active, client]);
  return result;
}

/** Bumps when the app returns to the foreground, so listeners reconnect. */
function useForegroundRevision(): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRevision((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);
  return revision;
}

function useNowWhile(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(
      () => setNow(Date.now()),
      STUCK_CHECK_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * One assistant conversation: the workspace agent for the whole library or the
 * directory-scoped agent for a directory (ADR 008). Each reply is a durable
 * agent turn (ADR 010) that runs on the server: leaving the screen or
 * backgrounding the app never stops it, and coming back re-attaches to it.
 * Only Stop cancels.
 */
export function useAgentChat(
  userId: string | undefined,
  initialThreadId: string | null,
  chatScope: IAgentChatScope,
  options: { onThreadCreated?: (threadId: string) => void } = {},
) {
  const { onThreadCreated } = options;
  const client = useQueryClient();
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [pendingTurn, setPendingTurn] = useState<IPendingTurn | null>(null);
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const foregroundRevision = useForegroundRevision();

  useEffect(() => {
    if (initialThreadId) setThreadId(initialThreadId);
  }, [initialThreadId]);

  const threadKey = queryKeys.agentThread(userId ?? '', threadId ?? '');
  const threadQuery = useQuery({
    queryKey: threadKey,
    enabled: Boolean(userId && threadId),
    queryFn: () => {
      if (!userId || !threadId) throw new Error('Chat unavailable');
      return getAgentThreadFromFirestore(userId, threadId);
    },
  });

  // Live thread doc; messages are re-read from the server when a turn writes one.
  useEffect(() => {
    if (!userId || !threadId) return;
    const key = queryKeys.agentThread(userId, threadId);
    let latestThread: IAgentThread | null = null;
    const messageSync = createAgentThreadMessageSync({
      userId,
      threadId,
      onMessages: (messages) => {
        // Apply to the latest cached thread, never to a thread read earlier.
        client.setQueryData<GetAgentThreadResponse | null>(key, (current) => {
          const thread = current?.thread ?? latestThread;
          return thread ? { thread, messages } : current;
        });
      },
    });
    let listening = true;
    const unsubscribe = subscribeAgentThread(userId, threadId, {
      onThread: (thread, meta) => {
        if (!listening || meta.fromCache || !thread) return;
        latestThread = thread;
        client.setQueryData<GetAgentThreadResponse | null>(key, (current) =>
          current ? { ...current, thread } : current,
        );
        messageSync.onThread(thread);
      },
      onError: (snapshotError) => {
        if (listening) setError(snapshotError.message);
      },
    });
    return () => {
      listening = false;
      unsubscribe();
      messageSync.dispose();
    };
  }, [client, foregroundRevision, threadId, userId]);

  const threadData = threadQuery.data ?? null;
  const pending =
    pendingTurn && pendingTurn.threadId === threadId ? pendingTurn : null;
  const followTurnId =
    (pending?.started ? pending.turnId : undefined) ??
    threadData?.thread.activeTurnId;

  const turnKey = queryKeys.agentTurn(
    userId ?? '',
    threadId ?? '',
    followTurnId ?? '',
  );
  const turnQuery = useQuery({
    queryKey: turnKey,
    enabled: Boolean(userId && threadId && followTurnId),
    queryFn: () => {
      if (!userId || !threadId || !followTurnId)
        throw new Error('Turn unavailable');
      return getAgentTurnFromFirestore(userId, threadId, followTurnId);
    },
  });

  useEffect(() => {
    if (!userId || !threadId || !followTurnId) return;
    const key = queryKeys.agentTurn(userId, threadId, followTurnId);
    let listening = true;
    const unsubscribe = subscribeAgentTurn(userId, threadId, followTurnId, {
      onTurn: (turn, meta) => {
        // A cached snapshot can show a stale "running" turn; wait for the server.
        if (!listening || meta.fromCache || !turn) return;
        client.setQueryData<AgentTurn | null>(key, turn);
      },
      onError: (snapshotError) => {
        if (listening) setError(snapshotError.message);
      },
    });
    return () => {
      listening = false;
      unsubscribe();
    };
  }, [client, followTurnId, foregroundRevision, threadId, userId]);

  const turn =
    turnQuery.data && turnQuery.data.id === followTurnId
      ? turnQuery.data
      : null;
  const turnActive = isAgentTurnActive(turn);
  const nowMs = useNowWhile(turnActive);

  // The sent turn's reply is stored: stop tracking it as pending.
  useEffect(() => {
    if (
      pendingTurn &&
      threadData?.messages.some(
        (message) =>
          message.turnId === pendingTurn.turnId && message.role === 'assistant',
      )
    ) {
      setPendingTurn((current) =>
        current?.turnId === pendingTurn.turnId ? null : current,
      );
    }
  }, [pendingTurn, threadData?.messages]);

  // A finished turn changed the drawer's chat order and preview.
  const finishedTurnId =
    turn && isAgentTurnTerminal(turn.status) ? turn.id : null;
  useEffect(() => {
    if (finishedTurnId && userId) {
      void client.invalidateQueries({
        queryKey: queryKeys.agentThreads(userId),
      });
    }
  }, [client, finishedTurnId, userId]);

  const entries = useMemo(
    () =>
      mergeAgentConversation({
        messages: threadData?.messages ?? [],
        turn,
        pendingUser: pending
          ? {
              turnId: pending.turnId,
              content: pending.content,
              createdAt: pending.createdAt,
              promptContext: pending.promptContext,
            }
          : null,
        nowMs,
      }),
    [nowMs, pending, threadData?.messages, turn],
  );
  const messages = useMemo<IChatMessage[]>(
    () => entries.map(fromConversationEntry),
    [entries],
  );
  /** Clarifying questions on the latest reply, answered one at a time. */
  const openQuestions = useMemo(
    () => findOpenAgentQuestions(entries),
    [entries],
  );

  const isWorking = Boolean(pending && !turn) || turnActive;

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || isWorking || !userId) return;
      const targetThreadId = threadId ?? newId('thread');
      const turnId = newId('turn');
      setError(null);
      setSending(true);
      setPendingTurn({
        threadId: targetThreadId,
        turnId,
        content: message,
        createdAt: new Date().toISOString(),
        promptContext: chatScope.promptContext,
        started: false,
      });
      if (!threadId) {
        // Name the route after the new thread first, so a remount re-attaches
        // to it instead of sending the first message again.
        setThreadId(targetThreadId);
        onThreadCreated?.(targetThreadId);
      }

      const markStarted = () =>
        setPendingTurn((current) =>
          current?.turnId === turnId ? { ...current, started: true } : current,
        );

      try {
        await startAgentTurn({
          scope: chatScope.scope,
          ...(chatScope.scope === 'directory' && chatScope.directoryId
            ? { directoryId: chatScope.directoryId }
            : {}),
          ...(chatScope.promptContext
            ? { promptContext: chatScope.promptContext }
            : {}),
          threadId: targetThreadId,
          turnId,
          message,
        });
        markStarted();
      } catch (sendError) {
        // The app may have been backgrounded mid-call after the server started the turn.
        const started = await getAgentTurnFromFirestore(
          userId,
          targetThreadId,
          turnId,
        ).catch(() => null);
        if (started) {
          markStarted();
        } else {
          setPendingTurn((current) =>
            current?.turnId === turnId ? null : current,
          );
          if (isLimitError(sendError)) {
            setLimitReached(true);
            setError(LIMIT_MESSAGE);
          } else {
            setError(getCallableErrorMessage(sendError));
          }
        }
      } finally {
        setSending(false);
        void client.invalidateQueries({
          queryKey: queryKeys.agentThreads(userId),
        });
      }
    },
    [
      chatScope.directoryId,
      chatScope.promptContext,
      chatScope.scope,
      client,
      isWorking,
      onThreadCreated,
      threadId,
      userId,
    ],
  );

  const stop = useCallback(async () => {
    if (!threadId || !turn || isAgentTurnTerminal(turn.status)) return;
    setStopping(true);
    try {
      await cancelAgentTurn({ threadId, turnId: turn.id });
    } catch (stopError) {
      setError(getCallableErrorMessage(stopError));
    } finally {
      setStopping(false);
    }
  }, [threadId, turn]);

  return {
    threadId,
    messages,
    openQuestions,
    loading: Boolean(threadId) && threadQuery.isLoading && !pending,
    sending,
    isWorking,
    canStop: Boolean(turn) && turnActive && !turn?.cancelRequested && !stopping,
    stopping: stopping || Boolean(turn?.cancelRequested),
    error,
    limitReached,
    send,
    stop,
  };
}
