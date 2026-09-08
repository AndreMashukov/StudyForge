/** LangGraph node: load flashcard generation context. */
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../../artifact-pipeline-state-keys';
import type { FlashcardsState } from '../flashcards-state';
import { FlashcardsStateValue } from '../flashcards-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'load_context';

export type LoadContextNodeResult = Partial<FlashcardsState>;

export async function loadContextNode(
  state: typeof FlashcardsStateValue.State
): Promise<LoadContextNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
    if (!definition) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'LoadContext node requires artifact_definition in state',
      };
    }

    const jobInput = state[ARTIFACT_PIPELINE_STATE_KEYS.jobInput];
    if (!jobInput) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'LoadContext node requires job_input in state',
      };
    }

    const loadedContext = await definition.loadContext(jobInput);
    const result = {
      [ARTIFACT_PIPELINE_STATE_KEYS.context]: loadedContext,
    } as LoadContextNodeResult;
    logNodeExitOk(NODE_NAME, state);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    const message =
      err instanceof Error ? err.message : 'Failed to load flashcard context';
    return {
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
      [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: message,
    };
  }
}

export default loadContextNode;
