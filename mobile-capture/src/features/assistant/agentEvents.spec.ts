import { describe, expect, it } from 'vitest';
import {
  applyAgentEvent,
  emptyAssistantMessage,
  replyCards,
} from './agentEvents';

const card = {
  itemType: 'document' as const,
  id: 'd1',
  title: 'Mitochondria',
  directoryId: 'cell',
};

describe('applyAgentEvent', () => {
  it('streams deltas and status, then takes the final reply from done', () => {
    let message = emptyAssistantMessage('m1');
    message = applyAgentEvent(message, {
      type: 'status',
      message: 'Searching your library',
    });
    message = applyAgentEvent(message, { type: 'delta', text: 'Found ' });
    message = applyAgentEvent(message, { type: 'delta', text: 'one' });
    expect(message).toMatchObject({
      content: 'Found one',
      status: 'Searching your library',
      streaming: true,
    });

    message = applyAgentEvent(message, {
      type: 'done',
      response: {
        reply: 'Found one match.',
        threadId: 't1',
        executedActions: [],
        proposedDeletes: [],
        referencedItems: [card],
      },
    });
    expect(message).toMatchObject({
      content: 'Found one match.',
      streaming: false,
      status: undefined,
      referencedItems: [card],
    });
  });

  it('dedupes references replayed before done', () => {
    let message = emptyAssistantMessage('m1');
    message = applyAgentEvent(message, { type: 'reference', item: card });
    message = applyAgentEvent(message, { type: 'reference', item: card });
    expect(message.referencedItems).toEqual([card]);
  });
});

describe('replyCards', () => {
  it('lists presented items, then created artifacts, skipping duplicates and rules', () => {
    const message = {
      ...emptyAssistantMessage('m1'),
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
