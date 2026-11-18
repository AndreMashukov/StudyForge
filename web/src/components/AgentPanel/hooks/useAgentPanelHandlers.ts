import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import type { AgentPromptContext, AgentScope, AgentTurn } from '@shared-types';
import { isAgentTurnTerminal } from '@shared-types';
import {
  useCancelAgentTurnMutation,
  useStartAgentTurnMutation,
} from '../../../store/api/AgentThread';
import { formatLocalIsoDate } from '../../../utils/dateUtils';
import { readAgentRequestErrorMessage } from '../agentPanelErrors';
import type { IAgentPendingTurn } from './useAgentConversation';

function promptContextDirectoryId(
  promptContext: AgentPromptContext | undefined,
): string | undefined {
  if (!promptContext) {
    return undefined;
  }
  if (promptContext.type === 'directory' || promptContext.type === 'document') {
    return promptContext.directoryId;
  }
  return undefined;
}

export interface IUseAgentPanelHandlers {
  handleSend: (rawMessage: string) => Promise<void>;
  handleStop: () => Promise<void>;
  handleNewChat: () => void;
  handleSelectThread: (threadId: string) => void;
  isStopping: boolean;
}

export function useAgentPanelHandlers(input: {
  scope: AgentScope;
  directoryId?: string;
  threadId: string | undefined;
  activePromptContext: AgentPromptContext | undefined;
  turn: AgentTurn | null;
  isWorking: boolean;
  selectThread: (threadId: string | undefined) => void;
  rememberThread: (threadId: string | undefined) => void;
  setPendingTurn: Dispatch<SetStateAction<IAgentPendingTurn | null>>;
  setInput: (value: string) => void;
  setError: (value: string | null) => void;
}): IUseAgentPanelHandlers {
  const {
    scope,
    directoryId,
    threadId,
    activePromptContext,
    turn,
    isWorking,
    selectThread,
    rememberThread,
    setPendingTurn,
    setInput,
    setError,
  } = input;
  const [startAgentTurn] = useStartAgentTurnMutation();
  const [cancelAgentTurn, { isLoading: isStopping }] =
    useCancelAgentTurnMutation();
  // The send the panel still cares about; a thread switch forgets it.
  const latestSendRef = useRef<string | null>(null);

  const handleSend = useCallback(
    async (rawMessage: string) => {
      const trimmed = rawMessage.trim();
      if (!trimmed || isWorking) {
        return;
      }

      const targetThreadId = threadId ?? crypto.randomUUID();
      const turnId = crypto.randomUUID();
      latestSendRef.current = turnId;
      setError(null);
      setInput('');
      setPendingTurn({
        threadId: targetThreadId,
        turnId,
        content: trimmed,
        createdAt: new Date().toISOString(),
        promptContext: activePromptContext,
        started: false,
      });
      // Remember the thread first, so closing the panel mid-start still finds it.
      rememberThread(targetThreadId);

      try {
        await startAgentTurn({
          scope,
          directoryId:
            promptContextDirectoryId(activePromptContext) ?? directoryId,
          message: trimmed,
          threadId: targetThreadId,
          turnId,
          promptContext: activePromptContext,
          clientLocalDate: formatLocalIsoDate(),
        }).unwrap();
        setPendingTurn((current) =>
          current?.turnId === turnId ? { ...current, started: true } : current,
        );
        if (!threadId && latestSendRef.current === turnId) {
          selectThread(targetThreadId);
        }
      } catch (startError) {
        if (latestSendRef.current !== turnId) {
          return;
        }
        setPendingTurn((current) =>
          current?.turnId === turnId ? null : current,
        );
        if (!threadId) {
          rememberThread(undefined);
        }
        setInput(trimmed);
        setError(
          readAgentRequestErrorMessage(startError, 'Failed to send message'),
        );
      }
    },
    [
      activePromptContext,
      directoryId,
      isWorking,
      rememberThread,
      scope,
      selectThread,
      setError,
      setInput,
      setPendingTurn,
      startAgentTurn,
      threadId,
    ],
  );

  const handleStop = useCallback(async () => {
    if (!threadId || !turn || isAgentTurnTerminal(turn.status)) {
      return;
    }
    try {
      await cancelAgentTurn({ threadId, turnId: turn.id }).unwrap();
    } catch (stopError) {
      setError(readAgentRequestErrorMessage(stopError, 'Failed to stop the agent'));
    }
  }, [cancelAgentTurn, setError, threadId, turn]);

  // Switching threads never stops a running turn; it keeps going server-side.
  const handleNewChat = useCallback(() => {
    latestSendRef.current = null;
    setPendingTurn(null);
    setError(null);
    selectThread(undefined);
  }, [selectThread, setError, setPendingTurn]);

  const handleSelectThread = useCallback(
    (nextThreadId: string) => {
      if (nextThreadId === threadId) {
        return;
      }
      latestSendRef.current = null;
      setPendingTurn(null);
      setError(null);
      selectThread(nextThreadId);
    },
    [selectThread, setError, setPendingTurn, threadId],
  );

  return {
    handleSend,
    handleStop,
    handleNewChat,
    handleSelectThread,
    isStopping,
  };
}
