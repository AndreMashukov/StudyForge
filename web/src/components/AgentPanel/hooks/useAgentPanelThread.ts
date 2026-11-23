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
  /** Shows only this thread; switching and remembering threads is off. */
  pinnedThreadId?: string;
}): IUseAgentPanelThread {
  const { userId, scope, directoryId, pinnedThreadId } = input;
  const [threadId, setThreadId] = useState<string | undefined>();

  useEffect(() => {
    if (pinnedThreadId) {
      return;
    }
    setThreadId(userId ? readActiveThreadId(userId, scope, directoryId) : undefined);
  }, [directoryId, pinnedThreadId, scope, userId]);

  const rememberThread = useCallback(
    (nextThreadId: string | undefined) => {
      if (pinnedThreadId) {
        return;
      }
      writeActiveThreadId(userId, nextThreadId, scope, directoryId);
    },
    [directoryId, pinnedThreadId, scope, userId],
  );

  const selectThread = useCallback(
    (nextThreadId: string | undefined) => {
      if (pinnedThreadId) {
        return;
      }
      setThreadId(nextThreadId);
      rememberThread(nextThreadId);
    },
    [pinnedThreadId, rememberThread],
  );

  return {
    threadId: pinnedThreadId ?? threadId,
    selectThread,
    rememberThread,
  };
}
