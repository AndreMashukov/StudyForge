import { useCallback, useEffect, useState } from 'react';
import type { AgentScope } from '@shared-types';
import {
  readActiveThreadId,
  writeActiveThreadId,
} from '../agentThreadStorage';

export interface IUseAgentPanelThread {
  threadId: string | undefined;
  /** Shows a thread (or a new chat) and remembers it for this panel context. */
  selectThread: (threadId: string | undefined) => void;
  /** Remembers a thread without showing it yet (new chat while start is in flight). */
  rememberThread: (threadId: string | undefined) => void;
}

export function useAgentPanelThread(input: {
  userId: string | undefined;
  scope: AgentScope;
  directoryId?: string;
}): IUseAgentPanelThread {
  const { userId, scope, directoryId } = input;
  const [threadId, setThreadId] = useState<string | undefined>();

  useEffect(() => {
    setThreadId(userId ? readActiveThreadId(userId, scope, directoryId) : undefined);
  }, [directoryId, scope, userId]);

  const rememberThread = useCallback(
    (nextThreadId: string | undefined) => {
      writeActiveThreadId(userId, nextThreadId, scope, directoryId);
    },
    [directoryId, scope, userId],
  );

  const selectThread = useCallback(
    (nextThreadId: string | undefined) => {
      setThreadId(nextThreadId);
      rememberThread(nextThreadId);
    },
    [rememberThread],
  );

  return { threadId, selectThread, rememberThread };
}
