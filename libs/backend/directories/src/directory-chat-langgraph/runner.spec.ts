import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GraphRecursionError } from '@langchain/langgraph';

import { DIRECTORY_CHAT_PIPELINE_STATE_KEYS } from '../directory-chat-pipeline-state-keys';
import {
  DirectoryChatPipelineFailedError,
  runDirectoryChatGraphPipeline,
} from './runner';

vi.mock('./graph', async (importOriginal) => {
  const original = await importOriginal<typeof import('./graph')>();
  return {
    ...original,
    compiledDirectoryChatGraph: {
      invoke: vi.fn(),
    },
  };
});

import { compiledDirectoryChatGraph } from './graph';

describe('runDirectoryChatGraphPipeline', () => {
  beforeEach(() => {
    vi.mocked(compiledDirectoryChatGraph.invoke).mockReset();
  });

  it('returns final state when the graph completes successfully', async () => {
    vi.mocked(compiledDirectoryChatGraph.invoke).mockResolvedValue({
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]: 'completed',
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.assistantResponse]: 'Done',
    });

    const result = await runDirectoryChatGraphPipeline(
      {
        [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.threadId]: 'user-1:dir-1',
      },
      'user-1:dir-1'
    );

    expect(result[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.assistantResponse]).toBe(
      'Done'
    );
  });

  it('throws DirectoryChatPipelineFailedError when outcome is failed', async () => {
    vi.mocked(compiledDirectoryChatGraph.invoke).mockResolvedValue({
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]: 'failed',
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.failureMessage]: 'Generation failed',
    });

    await expect(
      runDirectoryChatGraphPipeline(
        {
          [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.threadId]: 'user-1:dir-1',
        },
        'user-1:dir-1'
      )
    ).rejects.toBeInstanceOf(DirectoryChatPipelineFailedError);
  });

  it('maps GraphRecursionError to DirectoryChatPipelineFailedError', async () => {
    vi.mocked(compiledDirectoryChatGraph.invoke).mockRejectedValue(
      new GraphRecursionError('recursion limit')
    );

    await expect(
      runDirectoryChatGraphPipeline(
        {
          [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.threadId]: 'user-1:dir-1',
        },
        'user-1:dir-1'
      )
    ).rejects.toBeInstanceOf(DirectoryChatPipelineFailedError);
  });
});
