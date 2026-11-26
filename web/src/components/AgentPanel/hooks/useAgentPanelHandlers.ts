import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import type {
  AgentPromptContext,
  AgentScope,
  AgentTurn,
  IAgentPromptMenuItem,
} from '@shared-types';
import { isAgentTurnTerminal } from '@shared-types';
import {
  agentThreadApi,
  useCancelAgentTurnMutation,
  useStartAgentTurnMutation,
} from '../../../store/api/AgentThread';
import { useAppDispatch } from '../../../hooks/redux';
import { clearThreadStarting, markThreadStarting } from '../agentThreadStarts';
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
  handleSend: (
    rawMessage: string,
    options?: { fromQuestionCard?: boolean; agentPrompt?: IAgentPromptMenuItem },
  ) => Promise<void>;
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
  /** Clears or restores the saved agent prompt picked in the "/" menu. */
  setAgentPrompt: (value: IAgentPromptMenuItem | null) => void;
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
    setAgentPrompt,
    setError,
  } = input;
  const dispatch = useAppDispatch();
  const [startAgentTurn] = useStartAgentTurnMutation();
  const [cancelAgentTurn, { isLoading: isStopping }] =
    useCancelAgentTurnMutation();
  // The send the panel still cares about; a thread switch forgets it.
  const latestSendRef = useRef<string | null>(null);

  const handleSend = useCallback(
    async (
      rawMessage: string,
      options?: {
        /**
         * Answers from the question card: leave the composer draft alone. On
         * failure the card reappears with the questions, so nothing is lost.
         */
        fromQuestionCard?: boolean;
        /** A saved agent prompt to run; `rawMessage` is then optional extra detail. */
        agentPrompt?: IAgentPromptMenuItem;
      },
    ) => {
      const keepInput = options?.fromQuestionCard === true;
      const agentPrompt = keepInput ? undefined : options?.agentPrompt;
      const trimmed = rawMessage.trim();
      if ((!trimmed && !agentPrompt) || isWorking) {
        return;
      }

      const targetThreadId = threadId ?? crypto.randomUUID();
      const turnId = crypto.randomUUID();
      latestSendRef.current = turnId;
      setError(null);
      if (!keepInput) {
        setInput('');
        setAgentPrompt(null);
      }
      setPendingTurn({
        threadId: targetThreadId,
        turnId,
        content: trimmed,
        createdAt: new Date().toISOString(),
        promptContext: activePromptContext,
        ...(agentPrompt ? { agentPromptName: agentPrompt.name } : {}),
        started: false,
      });
      // Remember the thread first, so closing the panel mid-start still finds it.
      rememberThread(targetThreadId);
      const isNewThread = !threadId;
      if (isNewThread) {
        markThreadStarting(targetThreadId);
      }

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
          ...(agentPrompt
            ? { agentPrompt: { source: agentPrompt.source, id: agentPrompt.id } }
            : {}),
        }).unwrap();
        setPendingTurn((current) =>
          current?.turnId === turnId ? { ...current, started: true } : current,
        );
        if (isNewThread) {
          // A panel that reopened mid-start read "not found": read it again.
          dispatch(
            agentThreadApi.util.invalidateTags([
              { type: 'AgentThread', id: targetThreadId },
            ]),
          );
        }
        if (isNewThread && latestSendRef.current === turnId) {
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
        if (!keepInput) {
          setInput(trimmed);
          setAgentPrompt(agentPrompt ?? null);
        }
        setError(
          readAgentRequestErrorMessage(startError, 'Failed to send message'),
        );
      } finally {
        if (isNewThread) {
          clearThreadStarting(targetThreadId);
        }
      }
    },
    [
      activePromptContext,
      directoryId,
      dispatch,
      isWorking,
      rememberThread,
      scope,
      selectThread,
      setError,
      setAgentPrompt,
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
      setError(
        readAgentRequestErrorMessage(stopError, 'Failed to stop the agent'),
      );
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
