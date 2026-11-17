import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgentPromptContext, AgentScope } from '@shared-types';
import {
  getAgentThreadFromFirestore,
  listAgentThreadsFromFirestore,
} from '@studyforge/client-data/agentThreadFirestore';
import { AgentLimitError, streamAgentMessage } from '../../lib/api/agentStream';
import { LIMIT_MESSAGE } from '../../lib/api/studyforgeApi';
import { queryKeys } from '../../lib/api/queryKeys';
import {
  applyAgentEvent,
  emptyAssistantMessage,
  fromThreadMessage,
  type IChatMessage,
} from './agentEvents';

export interface IAgentChatScope {
  scope: AgentScope;
  directoryId?: string;
  promptContext?: AgentPromptContext;
}

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
 * One assistant conversation: the workspace agent for the whole library or the
 * directory-scoped agent for a directory (decision 3). Loads an existing thread
 * from Firestore and streams new turns over SSE.
 */
export function useAgentChat(
  userId: string | undefined,
  initialThreadId: string | null,
  chatScope: IAgentChatScope,
) {
  const client = useQueryClient();
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(initialThreadId));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!userId || !initialThreadId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAgentThreadFromFirestore(userId, initialThreadId)
      .then((thread) => {
        if (!cancelled)
          setMessages(thread ? thread.messages.map(fromThreadMessage) : []);
      })
      .catch((loadError: unknown) => {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load this chat.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, initialThreadId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || sending) return;
      const assistantId = newId('assistant');
      setError(null);
      setSending(true);
      setMessages((current) => [
        ...current,
        {
          ...emptyAssistantMessage(newId('user')),
          role: 'user',
          content: message,
          streaming: false,
        },
        emptyAssistantMessage(assistantId),
      ]);
      const update = (fn: (value: IChatMessage) => IChatMessage) =>
        setMessages((current) =>
          current.map((entry) =>
            entry.id === assistantId ? fn(entry) : entry,
          ),
        );

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await streamAgentMessage(
          {
            scope: chatScope.scope,
            ...(chatScope.scope === 'directory' && chatScope.directoryId
              ? { directoryId: chatScope.directoryId }
              : {}),
            ...(chatScope.promptContext
              ? { promptContext: chatScope.promptContext }
              : {}),
            ...(threadId ? { threadId } : {}),
            turnId: newId('turn'),
            message,
          },
          {
            signal: controller.signal,
            onEvent: (event) => {
              if (event.type === 'thread') setThreadId(event.threadId);
              if (event.type === 'error') setError(event.message);
              update((entry) => applyAgentEvent(entry, event));
            },
          },
        );
      } catch (sendError) {
        if (sendError instanceof AgentLimitError) {
          setLimitReached(true);
          setError(LIMIT_MESSAGE);
        } else if (!controller.signal.aborted) {
          setError(
            sendError instanceof Error
              ? sendError.message
              : 'The assistant could not answer.',
          );
        }
        update((entry) => ({ ...entry, streaming: false, status: undefined }));
      } finally {
        setSending(false);
        abortRef.current = null;
        if (userId)
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
      sending,
      threadId,
      userId,
    ],
  );

  return { threadId, messages, loading, sending, error, limitReached, send };
}
