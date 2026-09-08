import { logger } from 'firebase-functions/v2';
import { GraphRecursionError } from '@langchain/langgraph';

import { ArtifactAgentPipelineFailedError } from '../../artifact-errors';
import {
  createEmptyDiagnostics,
  type ArtifactAgentJobInput,
} from '../../artifact-definition';
import { flashcardsDefinition } from '../../flashcards/flashcard-definition';
import type { IFlashcardJobPayload } from '../../flashcards/flashcard-types';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import {
  flashcardsGraph,
  FLASHCARDS_MAX_REPAIR_ITERATIONS,
} from './flashcards-graph';
import { createInitialFlashcardsState } from './flashcards-state';

function readFinalOutcome(
  finalState: Record<string, unknown>
): 'completed' | 'failed' | undefined {
  const outcome = finalState[ARTIFACT_PIPELINE_STATE_KEYS.outcome];
  if (outcome === 'completed' || outcome === 'failed') {
    return outcome;
  }
  return undefined;
}

function readFinalFailureMessage(finalState: Record<string, unknown>): string {
  const message = finalState[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage];
  return typeof message === 'string' && message.trim().length > 0
    ? message
    : 'Automated verification failed';
}

function buildInitialState(input: ArtifactAgentJobInput<IFlashcardJobPayload>) {
  const diagnostics = {
    ...createEmptyDiagnostics(flashcardsDefinition),
    orchestrationMode: 'langgraph-runner' as const,
  };
  return createInitialFlashcardsState({
    definition: flashcardsDefinition,
    jobInput: input,
    diagnostics,
  });
}

export async function runFlashcardsPipeline(
  input: ArtifactAgentJobInput<IFlashcardJobPayload>
): Promise<void> {
  if (input.artifactKind !== 'flashcards') {
    throw new Error(
      `runFlashcardsPipeline received unexpected artifactKind: ${String(
        input.artifactKind
      )}`
    );
  }

  logger.info('Starting flashcards LangGraph pipeline', {
    artifactKind: input.artifactKind,
    userId: input.userId,
    recordId: input.recordId,
    jobId: input.jobId,
    orchestrationMode: 'langgraph-runner',
  });

  const initialState = buildInitialState(input);
  const recursionLimit = 2 * FLASHCARDS_MAX_REPAIR_ITERATIONS + 4;

  let finalState: Record<string, unknown>;
  try {
    finalState = (await flashcardsGraph.invoke(initialState, {
      recursionLimit,
      configurable: {
        thread_id: input.jobId,
      },
    })) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof GraphRecursionError) {
      logger.warn('Flashcards LangGraph pipeline exceeded recursionLimit', {
        artifactKind: input.artifactKind,
        userId: input.userId,
        recordId: input.recordId,
        jobId: input.jobId,
        recursionLimit,
        orchestrationMode: 'langgraph-runner',
      });
      throw new ArtifactAgentPipelineFailedError(
        `Flashcards LangGraph pipeline exceeded recursionLimit (jobId=${input.jobId})`
      );
    }
    throw err;
  }

  const outcome = readFinalOutcome(finalState);

  if (outcome === 'failed') {
    const message = readFinalFailureMessage(finalState);
    logger.warn('Flashcards LangGraph pipeline failed verification', {
      artifactKind: input.artifactKind,
      userId: input.userId,
      recordId: input.recordId,
      jobId: input.jobId,
      message,
      orchestrationMode: 'langgraph-runner',
    });
    throw new ArtifactAgentPipelineFailedError(message);
  }

  if (outcome !== 'completed') {
    throw new Error(
      `Flashcards LangGraph pipeline finished without a terminal outcome (jobId=${input.jobId})`
    );
  }

  logger.info('Flashcards LangGraph pipeline completed', {
    artifactKind: input.artifactKind,
    userId: input.userId,
    recordId: input.recordId,
    jobId: input.jobId,
    orchestrationMode: 'langgraph-runner',
  });
}
