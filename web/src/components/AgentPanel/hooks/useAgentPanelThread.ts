import { useCallback, useEffect, useRef, useState } from 'react';
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
  /**
   * Thread to show first instead of the remembered one (`threadId: null` =
   * new chat). Applied once, then remembered like a normal selection.
   */
  initialThread?: { threadId: string | null };
}): IUseAgentPanelThread {
  const { userId, scope, directoryId, pinnedThreadId, initialThread } = input;
  const [threadId, setThreadId] = useState<string | undefined>();
  const initialThreadRef = useRef(initialThread);

  useEffect(() => {
    if (pinnedThreadId || !userId) {
      if (!pinnedThreadId) setThreadId(undefined);
      return;
    }
    const initial = initialThreadRef.current;
    if (initial) {
      initialThreadRef.current = undefined;
      const nextThreadId = initial.threadId ?? undefined;
      setThreadId(nextThreadId);
      writeActiveThreadId(userId, nextThreadId, scope, directoryId);
      return;
    }
    setThreadId(readActiveThreadId(userId, scope, directoryId));
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
