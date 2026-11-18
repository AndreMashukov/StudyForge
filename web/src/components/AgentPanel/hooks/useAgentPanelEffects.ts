import { useEffect, useRef, type RefObject } from 'react';
import type {
  AgentActionKind,
  AgentScope,
  AgentTurn,
  GetAgentThreadResponse,
} from '@shared-types';
import {
  buildAgentAssistantMessageId,
  isAgentTurnTerminal,
} from '@shared-types';
import { baseApi } from '../../../store/api/baseApi';
import { agentThreadApi } from '../../../store/api/AgentThread';
import { useAppDispatch } from '../../../hooks/redux';
import type { IAgentConversationEntry } from '../../../services/agentConversation';
import { threadMatchesPanelContext } from '../agentThreadStorage';
import { isAgentThreadMissingError } from '../agentPanelErrors';
import type { IAgentPendingTurn } from './useAgentConversation';

const RULE_CACHE_ACTION_KINDS = new Set<AgentActionKind>([
  'create_rule',
  'create_rule_from_blueprint',
  'update_rule',
  'attach_rule',
  'detach_rule',
]);

export function useAgentPanelEffects(input: {
  scope: AgentScope;
  directoryId?: string;
  threadId: string | undefined;
  threadData: GetAgentThreadResponse | undefined;
  threadError: unknown;
  turn: AgentTurn | null;
  entries: IAgentConversationEntry[];
  pendingTurn: IAgentPendingTurn | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  selectThread: (threadId: string | undefined) => void;
  clearPendingTurn: (turnId: string) => void;
  onMutated?: () => void;
}): void {
  const {
    scope,
    directoryId,
    threadId,
    threadData,
    threadError,
    turn,
    entries,
    pendingTurn,
    scrollRef,
    selectThread,
    clearPendingTurn,
    onMutated,
  } = input;
  const dispatch = useAppDispatch();
  const seenActionKeysRef = useRef(new Set<string>());
  const refreshedTurnIdRef = useRef<string | null>(null);

  // A remembered thread from another panel context, or one that was deleted.
  useEffect(() => {
    if (threadData && !threadMatchesPanelContext(threadData.thread, scope, directoryId)) {
      selectThread(undefined);
    }
  }, [directoryId, scope, selectThread, threadData]);

  useEffect(() => {
    if (threadId && threadError && isAgentThreadMissingError(threadError)) {
      selectThread(undefined);
    }
  }, [selectThread, threadError, threadId]);

  // New actions from the running turn: refresh rule caches and tell the host page.
  useEffect(() => {
    if (!turn) {
      return;
    }
    let mutated = false;
    let rulesChanged = false;
    for (const action of turn.executedActions) {
      const key = `${turn.id}:${action.kind}:${action.entityId ?? action.summary}`;
      if (seenActionKeysRef.current.has(key)) {
        continue;
      }
      seenActionKeysRef.current.add(key);
      mutated = true;
      rulesChanged ||= RULE_CACHE_ACTION_KINDS.has(action.kind);
    }
    if (rulesChanged) {
      dispatch(baseApi.util.invalidateTags(['Rules', 'DirectoryRules']));
    }
    if (mutated) {
      onMutated?.();
    }
  }, [dispatch, onMutated, turn]);

  // A finished turn changed the thread preview and order in the history menu.
  useEffect(() => {
    if (
      turn &&
      isAgentTurnTerminal(turn.status) &&
      refreshedTurnIdRef.current !== turn.id
    ) {
      refreshedTurnIdRef.current = turn.id;
      dispatch(
        agentThreadApi.util.invalidateTags([{ type: 'AgentThread', id: 'LIST' }]),
      );
    }
  }, [dispatch, turn]);

  // The sent turn's reply is stored: stop tracking it as pending.
  useEffect(() => {
    if (
      pendingTurn &&
      threadData?.messages.some(
        (message) =>
          message.id === buildAgentAssistantMessageId(pendingTurn.turnId),
      )
    ) {
      clearPendingTurn(pendingTurn.turnId);
    }
  }, [clearPendingTurn, pendingTurn, threadData?.messages]);

  const lastEntry = entries[entries.length - 1];
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [entries.length, lastEntry?.content, lastEntry?.live?.statusMessage, scrollRef]);
}
