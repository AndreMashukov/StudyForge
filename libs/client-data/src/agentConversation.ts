import type {
  AgentActionResult,
  AgentMessageTurnStatus,
  AgentPromptContext,
  AgentProposedDelete,
  AgentQuestion,
  AgentReferencedItem,
  AgentTurn,
  AgentTurnStatus,
  IAgentThreadMessage,
} from '@shared-types';
import {
  AGENT_TURN_HEARTBEAT_STALE_MS,
  AGENT_TURN_QUEUED_STALE_MS,
  buildAgentAssistantMessageId,
  buildAgentUserMessageId,
  isAgentTurnTerminal,
} from '@shared-types';

/** Live state of a turn still being answered, for the bubble that renders it. */
export interface IAgentConversationLiveState {
  status: AgentTurnStatus;
  statusMessage: string | null;
  cancelRequested: boolean;
  /** No progress for a while: show a "still working" hint and offer Stop. */
  stuck: boolean;
}

export interface IAgentConversationEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  promptContext?: AgentPromptContext;
  /** User messages that ran a saved agent prompt: its name; `content` is the extra text. */
  agentPromptName?: string;
  executedActions: AgentActionResult[];
  proposedDeletes: AgentProposedDelete[];
  referencedItems: AgentReferencedItem[];
  /** Clarifying questions this finished assistant reply asks. */
  questions?: AgentQuestion[];
  turnId?: string;
  turnStatus?: AgentMessageTurnStatus;
  /** Set while the turn is still queued or running. */
  live?: IAgentConversationLiveState;
  /** Optimistic user message not yet confirmed by the server. */
  pending?: boolean;
}

export interface IAgentPendingUserMessage {
  turnId: string;
  content: string;
  createdAt: string;
  promptContext?: AgentPromptContext;
  agentPromptName?: string;
}

export function isAgentTurnActive(turn: AgentTurn | null | undefined): boolean {
  return Boolean(turn && !isAgentTurnTerminal(turn.status));
}

export function isAgentTurnStuck(
  turn: AgentTurn | null | undefined,
  nowMs: number,
): boolean {
  if (!turn || isAgentTurnTerminal(turn.status)) {
    return false;
  }
  if (turn.status === 'queued') {
    return nowMs - Date.parse(turn.createdAt) > AGENT_TURN_QUEUED_STALE_MS;
  }
  const lastActivity = Date.parse(turn.heartbeatAt ?? turn.updatedAt);
  return nowMs - lastActivity > AGENT_TURN_HEARTBEAT_STALE_MS;
}

export function agentTurnMessageStatus(
  turn: AgentTurn,
): AgentMessageTurnStatus {
  if (turn.status === 'completed') {
    return turn.incomplete ? 'incomplete' : 'completed';
  }
  return turn.status === 'cancelled' ? 'cancelled' : 'failed';
}

function fromThreadMessage(
  message: IAgentThreadMessage,
): IAgentConversationEntry {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    ...(message.promptContext ? { promptContext: message.promptContext } : {}),
    ...(message.agentPrompt
      ? { agentPromptName: message.agentPrompt.name }
      : {}),
    executedActions: message.executedActions ?? [],
    proposedDeletes: message.proposedDeletes ?? [],
    referencedItems: message.referencedItems ?? [],
    ...(message.questions?.length ? { questions: message.questions } : {}),
    ...(message.turnId ? { turnId: message.turnId } : {}),
    ...(message.turnStatus ? { turnStatus: message.turnStatus } : {}),
  };
}

function fromTurn(turn: AgentTurn, nowMs: number): IAgentConversationEntry {
  const terminal = isAgentTurnTerminal(turn.status);
  return {
    id: buildAgentAssistantMessageId(turn.id),
    role: 'assistant',
    content: turn.reply,
    createdAt: turn.updatedAt,
    executedActions: turn.executedActions,
    proposedDeletes: turn.proposedDeletes,
    referencedItems: turn.referencedItems,
    ...(terminal && turn.questions.length > 0
      ? { questions: turn.questions }
      : {}),
    turnId: turn.id,
    ...(terminal
      ? { turnStatus: agentTurnMessageStatus(turn) }
      : {
          live: {
            status: turn.status,
            statusMessage: turn.statusMessage ?? null,
            cancelRequested: turn.cancelRequested,
            stuck: isAgentTurnStuck(turn, nowMs),
          },
        }),
  };
}

/** Questions the user can still answer, and the assistant entry that asked them. */
export interface IOpenAgentQuestions {
  entryId: string;
  questions: AgentQuestion[];
}

/**
 * Questions are open only on the newest entry: a finished assistant reply that
 * asked them. Any later message (an answer or anything else typed) closes them.
 */
export function findOpenAgentQuestions(
  entries: ReadonlyArray<IAgentConversationEntry>,
): IOpenAgentQuestions | null {
  // A message the user just sent closes the questions, whatever its position.
  if (entries.some((entry) => entry.pending)) {
    return null;
  }
  const last = entries[entries.length - 1];
  if (
    !last ||
    last.role !== 'assistant' ||
    last.live ||
    last.pending ||
    last.turnStatus !== 'completed' ||
    !last.questions ||
    last.questions.length === 0
  ) {
    return null;
  }
  return { entryId: last.id, questions: last.questions };
}

/**
 * One conversation from stored messages, the followed turn and an optimistic
 * user message. The turn's bubble renders from the turn doc until its stored
 * assistant message arrives, so finishing never flickers. Messages are
 * deduped by their deterministic ids (user-{turnId}, assistant-{turnId}).
 */
export function mergeAgentConversation(input: {
  messages: IAgentThreadMessage[];
  turn: AgentTurn | null;
  pendingUser: IAgentPendingUserMessage | null;
  nowMs: number;
}): IAgentConversationEntry[] {
  const entries = input.messages.map(fromThreadMessage);
  const ids = new Set(entries.map((entry) => entry.id));

  const pending = input.pendingUser;
  if (pending && !ids.has(buildAgentUserMessageId(pending.turnId))) {
    entries.push({
      id: buildAgentUserMessageId(pending.turnId),
      role: 'user',
      content: pending.content,
      createdAt: pending.createdAt,
      ...(pending.promptContext
        ? { promptContext: pending.promptContext }
        : {}),
      ...(pending.agentPromptName
        ? { agentPromptName: pending.agentPromptName }
        : {}),
      executedActions: [],
      proposedDeletes: [],
      referencedItems: [],
      turnId: pending.turnId,
      pending: true,
    });
    ids.add(buildAgentUserMessageId(pending.turnId));
  }

  const turn = input.turn;
  if (turn && !ids.has(buildAgentAssistantMessageId(turn.id))) {
    entries.push(fromTurn(turn, input.nowMs));
  } else if (
    !turn &&
    pending &&
    !ids.has(buildAgentAssistantMessageId(pending.turnId))
  ) {
    // Start call in flight: show the bubble right away.
    entries.push({
      id: buildAgentAssistantMessageId(pending.turnId),
      role: 'assistant',
      content: '',
      createdAt: pending.createdAt,
      executedActions: [],
      proposedDeletes: [],
      referencedItems: [],
      turnId: pending.turnId,
      live: {
        status: 'queued',
        statusMessage: null,
        cancelRequested: false,
        stuck: false,
      },
    });
  }

  return entries;
}

/**
 * Smooth reveal for reply text that arrives in chunks (about one flush per
 * `flushIntervalMs`): returns how many characters to show next so the shown
 * text catches up with the target within roughly one flush interval.
 */
export function nextRevealLength(input: {
  displayedLength: number;
  targetLength: number;
  elapsedMs: number;
  flushIntervalMs?: number;
}): number {
  const { displayedLength, targetLength } = input;
  if (displayedLength >= targetLength) {
    return targetLength;
  }
  const flushIntervalMs = input.flushIntervalMs ?? 800;
  const remaining = targetLength - displayedLength;
  const step = Math.max(
    1,
    Math.ceil((remaining * Math.max(0, input.elapsedMs)) / flushIntervalMs),
  );
  return Math.min(targetLength, displayedLength + step);
}
