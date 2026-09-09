import { GraphRecursionError } from '@langchain/langgraph';
import { DIRECTORY_CHAT_PIPELINE_STATE_KEYS } from '../directory-chat-pipeline-state-keys';
import { compiledDirectoryChatGraph } from './graph';
import type { DirectoryChatState } from './state';

export class DirectoryChatPipelineFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DirectoryChatPipelineFailedError';
  }
}

function readOutcome(
  finalState: DirectoryChatState
): 'completed' | 'failed' | undefined {
  const outcome = finalState[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome];
  if (outcome === 'completed' || outcome === 'failed') {
    return outcome;
  }
  return undefined;
}

function readFailureMessage(finalState: DirectoryChatState): string {
  const message = finalState[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.failureMessage];
  return typeof message === 'string' && message.trim().length > 0
    ? message
    : 'Directory chat graph failed';
}

export async function runDirectoryChatGraphPipeline(
  initialState: Partial<DirectoryChatState>,
  threadId: string
): Promise<DirectoryChatState> {
  let finalState: DirectoryChatState;

  try {
    finalState = await compiledDirectoryChatGraph.invoke(initialState, {
      recursionLimit: 25,
      configurable: {
        thread_id: threadId,
      },
    });
  } catch (error) {
    if (error instanceof GraphRecursionError) {
      throw new DirectoryChatPipelineFailedError(
        'Directory chat graph exceeded recursion limit'
      );
    }
    throw error;
  }

  const outcome = readOutcome(finalState);
  if (outcome === 'failed' || outcome === undefined) {
    throw new DirectoryChatPipelineFailedError(readFailureMessage(finalState));
  }

  return finalState;
}
