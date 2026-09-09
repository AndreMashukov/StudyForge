import { describe, expect, it, vi } from 'vitest';

import type { DirectoryChatPromptContext } from '@shared-types';
import { LlmGenerationService } from '@study-forge/backend-llm/llm';
import { DIRECTORY_CHAT_PIPELINE_STATE_KEYS } from '../directory-chat-pipeline-state-keys';
import { respondNode } from './nodes/respond';
import { DirectoryChatStateValue } from './state';

vi.mock('@study-forge/backend-llm/llm', () => ({
  LlmGenerationService: {
    generateDirectoryChatAnswer: vi.fn(),
  },
}));

vi.mock('@study-forge/backend-core/lib/firestore-paths', () => ({
  FirestorePaths: {
    directoryChatMessages: vi.fn(() => ({
      doc: vi.fn(() => ({ id: 'assistant-doc-id' })),
    })),
  },
}));

const promptContext: DirectoryChatPromptContext = {
  directoryName: 'Test directory',
  userMessage: 'Hello',
  recentMessages: [],
  retrievedChunks: [],
};

function buildState() {
  return {
    [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.userId]: 'user-1',
    [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryId]: 'dir-1',
    [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.threadId]: 'user-1:dir-1',
    [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.assembledPrompt]: promptContext,
    [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.messages]: [],
  } as typeof DirectoryChatStateValue.State;
}

describe('respondNode', () => {
  it('returns assistantResponse and appends one assistant message on success', async () => {
    vi.mocked(LlmGenerationService.generateDirectoryChatAnswer).mockResolvedValue(
      'Assistant reply'
    );

    const result = await respondNode(buildState());

    expect(result[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.assistantResponse]).toBe(
      'Assistant reply'
    );
    expect(result[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.assistantMessage]).toEqual(
      expect.objectContaining({
        id: 'assistant-doc-id',
        role: 'assistant',
        content: 'Assistant reply',
      })
    );
    expect(result[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.messages]).toHaveLength(1);
    expect(result[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]).toBeUndefined();
  });

  it('sets failed outcome on LLM error without throwing', async () => {
    vi.mocked(LlmGenerationService.generateDirectoryChatAnswer).mockRejectedValue(
      new Error('LLM unavailable')
    );

    const result = await respondNode(buildState());

    expect(result[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]).toBe(
      'failed'
    );
    expect(result[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.failureMessage]).toBe(
      'LLM unavailable'
    );
  });
});
