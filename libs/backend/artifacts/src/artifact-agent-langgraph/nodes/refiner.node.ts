/** LangGraph node: refine the artifact after gate evaluation. */
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { DiagramQuizState } from '../diagram-quiz-state';
import { DiagramQuizStateValue } from '../diagram-quiz-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'refiner';

export type RefinerNodeResult = Partial<DiagramQuizState>;

/**
 * LangGraph node: refine the artifact after gate evaluation.
 *
 * The refiner node does NOT write `artifact_generation_model` or
 * `artifact_agent_model`. Those keys are set exclusively by `generate.node.ts`
 * and must remain stable across the verification loop. See the P6 audit fix.
 *
 * Emits `node_enter` and `node_exit` structured log lines with `jobId`.
 * `iteration` is `null` because the refiner sits at the head of the critic
 * loop; the conditional edge after `critic` reads `critic_iteration_count`
 * instead of attributing iteration here.
 */
export async function refinerNode(
  state: typeof DiagramQuizStateValue.State
): Promise<RefinerNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
    const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
    if (!definition) {
      throw new Error('Refiner node requires artifact_definition in state');
    }
    if (draft === undefined) {
      throw new Error('Refiner node requires artifact_draft in state');
    }

    if (!definition.refiner) {
      throw new Error('Refiner node requires definition.refiner');
    }
    const criticResult = state[ARTIFACT_PIPELINE_STATE_KEYS.criticResult];
    if (!criticResult) {
      throw new Error('Refiner node requires artifact_critic_result in state');
    }
    const result = {
      [ARTIFACT_PIPELINE_STATE_KEYS.draft]: await definition.refiner.refine(
        draft,
        criticResult,
        state[ARTIFACT_PIPELINE_STATE_KEYS.context] as Parameters<
          typeof definition.refiner.refine
        >[2],
        state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics] as Parameters<
          typeof definition.refiner.refine
        >[3]
      ),
    } as RefinerNodeResult;
    logNodeExitOk(NODE_NAME, state);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    throw err;
  }
}

export default refinerNode;
