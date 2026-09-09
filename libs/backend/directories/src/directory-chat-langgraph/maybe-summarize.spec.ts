import { describe, expect, it } from 'vitest';

import { DIRECTORY_CHAT_PIPELINE_STATE_KEYS } from '../directory-chat-pipeline-state-keys';
import { maybeSummarizeNode } from './nodes/maybe-summarize';
import type { DirectoryChatMessage } from '@shared-types';
import { DirectoryChatStateValue } from './state';

function message(index: number): DirectoryChatMessage {
  return {
    id: `msg-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `content-${index}`,
    createdAt: new Date().toISOString(),
  };
}

function buildState(messages: DirectoryChatMessage[]) {
  return {
    [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.messages]: messages,
    [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.threadId]: 'user-1:dir-1',
  } as typeof DirectoryChatStateValue.State;
}

describe('maybeSummarizeNode', () => {
  it('returns shouldSummarize false when message count is at the trigger threshold', async () => {
    const messages = Array.from({ length: 12 }, (_, index) => message(index));
    const result = await maybeSummarizeNode(buildState(messages));

    expect(result[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.shouldSummarize]).toBe(false);
  });

  it('returns shouldSummarize true when message count exceeds the trigger threshold', async () => {
    const messages = Array.from({ length: 13 }, (_, index) => message(index));
    const result = await maybeSummarizeNode(buildState(messages));

    expect(result[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.shouldSummarize]).toBe(true);
  });
});
