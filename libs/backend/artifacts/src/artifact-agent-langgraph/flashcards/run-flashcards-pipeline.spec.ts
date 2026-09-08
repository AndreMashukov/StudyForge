import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GraphRecursionError } from '@langchain/langgraph';

import { ArtifactAgentPipelineFailedError } from '../../artifact-errors';
import type { ArtifactAgentJobInput } from '../../artifact-definition';
import type { IFlashcardJobPayload } from '../../flashcards/flashcard-types';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import { runFlashcardsPipeline } from './run-flashcards-pipeline';

vi.mock('./flashcards-graph', async (importOriginal) => {
  const original = await importOriginal<typeof import('./flashcards-graph')>();
  return {
    ...original,
    flashcardsGraph: {
      invoke: vi.fn(),
    },
  };
});

import { flashcardsGraph } from './flashcards-graph';

const jobInput: ArtifactAgentJobInput<IFlashcardJobPayload> = {
  userId: 'user-1',
  directoryId: 'dir-1',
  recordId: 'rec-1',
  jobId: 'job-1',
  artifactKind: 'flashcards',
  payload: {
    artifactKind: 'flashcards',
    documentIds: ['doc-1'],
    directoryId: 'dir-1',
    recordId: 'rec-1',
  },
};

describe('runFlashcardsPipeline', () => {
  beforeEach(() => {
    vi.mocked(flashcardsGraph.invoke).mockReset();
  });

  it('resolves when the graph returns completed', async () => {
    vi.mocked(flashcardsGraph.invoke).mockResolvedValue({
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'completed',
    });

    await expect(runFlashcardsPipeline(jobInput)).resolves.toBeUndefined();
  });

  it('throws ArtifactAgentPipelineFailedError when outcome is failed', async () => {
    vi.mocked(flashcardsGraph.invoke).mockResolvedValue({
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
      [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: 'Gate blockers remained',
    });

    await expect(runFlashcardsPipeline(jobInput)).rejects.toBeInstanceOf(
      ArtifactAgentPipelineFailedError
    );
  });

  it('maps GraphRecursionError to ArtifactAgentPipelineFailedError', async () => {
    vi.mocked(flashcardsGraph.invoke).mockRejectedValue(
      new GraphRecursionError('recursion limit')
    );

    await expect(runFlashcardsPipeline(jobInput)).rejects.toBeInstanceOf(
      ArtifactAgentPipelineFailedError
    );
  });

  it('throws when the graph finishes without a terminal outcome', async () => {
    vi.mocked(flashcardsGraph.invoke).mockResolvedValue({});

    await expect(runFlashcardsPipeline(jobInput)).rejects.toThrow(
      'finished without a terminal outcome'
    );
  });
});
