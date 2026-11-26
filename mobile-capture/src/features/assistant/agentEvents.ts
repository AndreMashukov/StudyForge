import type {
  AgentActionResult,
  AgentProposedDelete,
  AgentReferencedItem,
} from '@shared-types';
import type { IAgentConversationEntry } from '@studyforge/client-data/agentConversation';
import type { ILibraryItemRef } from '../library/itemNavigation';

export interface IChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** User messages that ran a saved agent prompt. */
  agentPromptName?: string;
  referencedItems: AgentReferencedItem[];
  actions: AgentActionResult[];
  deletes: AgentProposedDelete[];
  status?: string;
  streaming: boolean;
  /** How a finished turn ended, when not normally ("Stopped"). */
  note?: string;
  /** Live turn with no progress for a while. */
  stuck?: boolean;
}

const TURN_STATUS_NOTES: Record<string, string> = {
  cancelled: 'Stopped',
  failed: "Couldn't finish",
  incomplete: 'Incomplete',
};

function liveStatus(entry: IAgentConversationEntry): string | undefined {
  const live = entry.live;
  if (!live) return undefined;
  if (live.cancelRequested) return 'Stopping…';
  if (live.statusMessage) return live.statusMessage;
  return live.status === 'queued' ? 'Starting…' : 'Thinking…';
}

/** One conversation entry (stored message or live turn) as a chat bubble. */
export function fromConversationEntry(
  entry: IAgentConversationEntry,
): IChatMessage {
  const note = entry.turnStatus ? TURN_STATUS_NOTES[entry.turnStatus] : undefined;
  const status = liveStatus(entry);
  return {
    id: entry.id,
    role: entry.role,
    content: entry.content,
    ...(entry.agentPromptName ? { agentPromptName: entry.agentPromptName } : {}),
    referencedItems: entry.referencedItems,
    actions: entry.executedActions,
    deletes: entry.live ? [] : entry.proposedDeletes,
    streaming: Boolean(entry.live),
    ...(status ? { status } : {}),
    ...(note ? { note } : {}),
    ...(entry.live?.stuck ? { stuck: true } : {}),
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
