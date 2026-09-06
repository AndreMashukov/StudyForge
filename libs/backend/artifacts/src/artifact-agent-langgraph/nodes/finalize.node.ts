/** LangGraph node: finalize the artifact and set the terminal outcome. */
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { DiagramQuizState } from '../diagram-quiz-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'finalize';

export type FinalizeNodeResult = Partial<DiagramQuizState>;

/**
 * LangGraph node: finalize the artifact and set the terminal outcome.
 *
 * The finalize node does NOT write `artifact_generation_model` or
 * `artifact_agent_model`. Those keys are set exclusively by `generate.node.ts`
 * and persist across the run so downstream persistence can read either field.
 * See the P6 audit fix.
 *
 * Emits `node_enter` and `node_exit` structured log lines with `jobId`. The
 * `iteration` field is `null` because finalize sits at the terminal tail of
 * the graph (post all loops) and is invoked exactly once per run.
 */
export async function finalizeNode(
  state: typeof DiagramQuizState.State
): Promise<FinalizeNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
    if (draft === undefined) {
      throw new Error('Finalize node requires artifact_draft in state');
    }

    const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
    if (!definition) {
      throw new Error('Finalize node requires artifact_definition in state');
    }

    const result = {
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: await definition.finalize(draft),
    } as FinalizeNodeResult;
    logNodeExitOk(NODE_NAME, state);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    throw err;
  }
}

export default finalizeNode;
