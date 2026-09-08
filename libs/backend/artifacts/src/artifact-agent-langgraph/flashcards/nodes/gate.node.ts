/** LangGraph node: evaluate the flashcard draft and persist gate diagnostics. */
import { runArtifactGates } from '../../../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../../artifact-pipeline-state-keys';
import type { FlashcardsState } from '../flashcards-state';
import { FlashcardsStateValue } from '../flashcards-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'gate';

export type GateNodeResult = Partial<FlashcardsState>;

export async function gateNode(
  state: typeof FlashcardsStateValue.State
): Promise<GateNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
    if (draft === undefined) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'Gate received undefined draft',
      };
    }

    const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
    if (!definition) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'Gate node requires artifact_definition in state',
      };
    }

    const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context];
    if (!context) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'Gate node requires artifact_context in state',
      };
    }

    const gateResult = await runArtifactGates(
      definition.gates,
      draft,
      context
    );

    const result = {
      [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: gateResult.failures,
    } as GateNodeResult;
    logNodeExitOk(NODE_NAME, state);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    const message =
      err instanceof Error ? err.message : 'Flashcard gate evaluation failed';
    return {
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
      [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: message,
    };
  }
}

export default gateNode;
