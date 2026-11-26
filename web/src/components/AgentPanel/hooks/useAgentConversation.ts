import { useMemo } from 'react';
import type {
  AgentPromptContext,
  AgentTurn,
  GetAgentThreadResponse,
} from '@shared-types';
import {
  useGetAgentThreadQuery,
  useGetAgentTurnQuery,
} from '../../../store/api/AgentThread';
import {
  isAgentTurnActive,
  mergeAgentConversation,
  type IAgentConversationEntry,
} from '../../../services/agentConversation';
import { useNowWhile } from './useNowWhile';

/** A message the user just sent; `started` once startAgentTurn returned. */
export interface IAgentPendingTurn {
  threadId: string;
  turnId: string;
  content: string;
  createdAt: string;
  promptContext?: AgentPromptContext;
  /** The saved agent prompt this message runs, if any. */
  agentPromptName?: string;
  started: boolean;
}

export interface IUseAgentConversation {
  entries: IAgentConversationEntry[];
  threadData: GetAgentThreadResponse | undefined;
  threadError: unknown;
  isThreadLoading: boolean;
  /** The turn the panel follows: the one just sent, or the thread's active turn. */
  turn: AgentTurn | null;
  /** A reply is being prepared (start in flight, queued or running). */
  isWorking: boolean;
}

const STUCK_CHECK_INTERVAL_MS = 5_000;

/**
 * Conversation for the open thread: stored messages plus the live turn doc of
 * the turn being answered. Closing the panel stops nothing; reopening it
 * finds the thread's active turn and follows it again.
 */
export function useAgentConversation(input: {
  threadId: string | undefined;
  pendingTurn: IAgentPendingTurn | null;
}): IUseAgentConversation {
  const { threadId, pendingTurn } = input;
  // A new chat has no thread id yet while its first start call is in flight.
  const pending =
    pendingTurn && (!threadId || pendingTurn.threadId === threadId)
      ? pendingTurn
      : null;

  const {
    data: threadQueryData,
    error: threadError,
    isLoading: isThreadLoading,
  } = useGetAgentThreadQuery({ threadId: threadId ?? '' }, { skip: !threadId });
  const threadData =
    threadQueryData?.thread.id === threadId ? threadQueryData : undefined;

  const followTurnId =
    (pending?.started ? pending.turnId : undefined) ??
    threadData?.thread.activeTurnId;
  const { data: turnData } = useGetAgentTurnQuery(
    { threadId: threadId ?? '', turnId: followTurnId ?? '' },
    { skip: !threadId || !followTurnId },
  );
  const turn = turnData && turnData.id === followTurnId ? turnData : null;

  const turnActive = isAgentTurnActive(turn);
  const nowMs = useNowWhile(turnActive, STUCK_CHECK_INTERVAL_MS);

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
              agentPromptName: pending.agentPromptName,
            }
          : null,
        nowMs,
      }),
    [nowMs, pending, threadData?.messages, turn],
  );

  return {
    entries,
    threadData,
    threadError,
    isThreadLoading,
    turn,
    isWorking: Boolean(pending && !turn) || turnActive,
  };
}
