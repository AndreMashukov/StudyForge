import { describe, expect, it } from 'vitest';
import type { IAgentConversationEntry } from '@studyforge/client-data/agentConversation';
import {
  fromConversationEntry,
  replyCards,
  type IChatMessage,
} from './agentEvents';

const card = {
  itemType: 'document' as const,
  id: 'd1',
  title: 'Mitochondria',
  directoryId: 'cell',
};

function assistantMessage(id: string): IChatMessage {
  return {
    id,
    role: 'assistant',
    content: '',
    referencedItems: [],
    actions: [],
    deletes: [],
    streaming: false,
  };
}

function entry(
  overrides: Partial<IAgentConversationEntry> = {},
): IAgentConversationEntry {
  return {
    id: 'assistant-turn-1',
    role: 'assistant',
    content: '',
    createdAt: '2026-11-18T12:00:00.000Z',
    executedActions: [],
    proposedDeletes: [],
    referencedItems: [],
    turnId: 'turn-1',
    ...overrides,
  };
}

describe('fromConversationEntry', () => {
  it('shows a live turn as streaming with its status', () => {
    const message = fromConversationEntry(
      entry({
        content: 'Found ',
        live: {
          status: 'running',
          statusMessage: 'Searching your library',
          cancelRequested: false,
          stuck: false,
        },
      }),
    );
    expect(message).toMatchObject({
      content: 'Found ',
      status: 'Searching your library',
      streaming: true,
    });
  });

  it('says Starting… for a queued turn and Stopping… after Stop', () => {
    const live = {
      status: 'queued' as const,
      statusMessage: null,
      cancelRequested: false,
      stuck: false,
    };
    expect(fromConversationEntry(entry({ live })).status).toBe('Starting…');
    expect(
      fromConversationEntry(
        entry({ live: { ...live, status: 'running', cancelRequested: true } }),
      ).status,
    ).toBe('Stopping…');
  });

  it('marks a stopped reply and hides delete proposals while live', () => {
    const proposal = {
      targetType: 'document' as const,
      targetId: 'd1',
      label: 'Old notes',
    };
    expect(
      fromConversationEntry(
        entry({ content: 'Stopped.', turnStatus: 'cancelled', proposedDeletes: [proposal] }),
      ),
    ).toMatchObject({ note: 'Stopped', streaming: false, deletes: [proposal] });
    expect(
      fromConversationEntry(
        entry({
          proposedDeletes: [proposal],
          live: {
            status: 'running',
            statusMessage: null,
            cancelRequested: false,
            stuck: true,
          },
        }),
      ),
    ).toMatchObject({ deletes: [], stuck: true });
  });

  it('leaves a normal finished reply without a note', () => {
    const message = fromConversationEntry(
      entry({ content: 'Done.', turnStatus: 'completed', referencedItems: [card] }),
    );
    expect(message.note).toBeUndefined();
    expect(message.referencedItems).toEqual([card]);
  });
});

describe('replyCards', () => {
  it('lists presented items, then created artifacts, skipping duplicates and rules', () => {
    const message = {
      ...assistantMessage('m1'),
      referencedItems: [card],
      actions: [
        {
          kind: 'generate_flashcards' as const,
          summary: 'Flashcards queued',
          entityType: 'flashcardSet',
          entityId: 'f1',
        },
        {
          kind: 'attach_rule' as const,
          summary: 'Attached rule',
          entityType: 'rule',
          entityId: 'r1',
        },
        {
          kind: 'update_document' as const,
          summary: 'Updated',
          entityType: 'document',
          entityId: 'd1',
        },
      ],
    };
    expect(replyCards(message)).toEqual([
      card,
      { itemType: 'flashcard', id: 'f1', title: 'Flashcards queued' },
    ]);
  });
});
