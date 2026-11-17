import type {
  AgentActionResult,
  AgentMessageStreamEvent,
  AgentProposedDelete,
  AgentReferencedItem,
  IAgentThreadMessage,
} from '@shared-types';
import type { ILibraryItemRef } from '../library/itemNavigation';

export interface IChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  referencedItems: AgentReferencedItem[];
  actions: AgentActionResult[];
  deletes: AgentProposedDelete[];
  status?: string;
  streaming: boolean;
}

export function emptyAssistantMessage(id: string): IChatMessage {
  return {
    id,
    role: 'assistant',
    content: '',
    referencedItems: [],
    actions: [],
    deletes: [],
    streaming: true,
  };
}

function pushUnique<T>(list: T[], next: T, key: (value: T) => string): T[] {
  const nextKey = key(next);
  return list.some((entry) => key(entry) === nextKey) ? list : [...list, next];
}

const referenceKey = (item: AgentReferencedItem) =>
  `${item.itemType}:${item.id}`;
const actionKey = (action: AgentActionResult) =>
  `${action.kind}:${action.entityId ?? ''}:${action.summary}`;
const deleteKey = (proposal: AgentProposedDelete) =>
  `${proposal.targetType}:${proposal.targetId}`;

/**
 * Fold one SSE event into the streaming assistant message. Live `action` and
 * `reference` events are replayed before `done`, so everything dedupes by key, and
 * `done` carries the authoritative final lists.
 */
export function applyAgentEvent(
  message: IChatMessage,
  event: AgentMessageStreamEvent,
): IChatMessage {
  switch (event.type) {
    case 'thread':
      return message;
    case 'status':
      return { ...message, status: event.message };
    case 'delta':
      return { ...message, content: message.content + event.text };
    case 'action':
      return {
        ...message,
        actions: pushUnique(message.actions, event.action, actionKey),
      };
    case 'delete_proposal':
      return {
        ...message,
        deletes: pushUnique(message.deletes, event.proposal, deleteKey),
      };
    case 'reference':
      return {
        ...message,
        referencedItems: pushUnique(
          message.referencedItems,
          event.item,
          referenceKey,
        ),
      };
    case 'done':
      return {
        ...message,
        content: event.response.reply,
        actions: event.response.executedActions,
        deletes: event.response.proposedDeletes,
        referencedItems: event.response.referencedItems,
        status: undefined,
        streaming: false,
      };
    case 'error':
      return { ...message, status: undefined, streaming: false };
  }
}

export function fromThreadMessage(message: IAgentThreadMessage): IChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    referencedItems: message.referencedItems ?? [],
    actions: message.executedActions ?? [],
    deletes: message.proposedDeletes ?? [],
    streaming: false,
  };
}

const ENTITY_ITEM_TYPES: Record<string, ILibraryItemRef['itemType']> = {
  directory: 'directory',
  document: 'document',
  quiz: 'quiz',
  flashcardSet: 'flashcard',
};

/**
 * Cards for a reply: items the agent presented, then items it created this turn
 * (a pending quiz, a new document). Rule changes stay as plain action lines.
 */
export function replyCards(message: IChatMessage): ILibraryItemRef[] {
  const cards: ILibraryItemRef[] = message.referencedItems.map((item) => ({
    ...item,
  }));
  const seen = new Set(cards.map((card) => `${card.itemType}:${card.id}`));
  for (const action of message.actions) {
    const itemType = action.entityType
      ? ENTITY_ITEM_TYPES[action.entityType]
      : undefined;
    if (!itemType || !action.entityId) continue;
    const key = `${itemType}:${action.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push({ itemType, id: action.entityId, title: action.summary });
  }
  return cards;
}
