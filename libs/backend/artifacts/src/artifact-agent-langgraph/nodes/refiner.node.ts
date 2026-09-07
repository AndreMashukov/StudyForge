/** LangGraph node: refine the artifact draft in response to critic findings. */
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { DiagramQuizState } from '../diagram-quiz-state';
import { DiagramQuizStateValue } from '../diagram-quiz-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'refiner';

export type RefinerNodeResult = Partial<DiagramQuizState>;

/**
 * LangGraph node: refine the artifact draft in response to critic findings.
 *
 * The refiner node does NOT write `artifact_generation_model` or
 * `artifact_agent_model`. Those keys are set exclusively by `generate.node.ts`
 * and must remain stable across the verification loop. See the P6 audit fix.
 *
 * The refiner does NOT increment `critic_iteration_count` - that counter
 * is owned by the `critic` node and is used to bound the verification
 * loop. Returning the counter from the refiner would double-count and break
 * the `critic_iteration_count >= maxCriticIterations` exit condition.
 *
 * Emits `node_enter` and `node_exit` structured log lines with `jobId`. The
 * `iteration` field on the log carries the current `critic_iteration_count`
 * value so operators can correlate log lines with the conditional-edge
 * routing decisions.
 */
export async function refinerNode(
  state: typeof DiagramQuizStateValue.State
): Promise<RefinerNodeResult> {
  const currentCriticCount = state.critic_iteration_count ?? 0;
  logNodeEnter(NODE_NAME, state, currentCriticCount);
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
    const refinedDraft = await definition.refiner.refine(
      draft,
      state[ARTIFACT_PIPELINE_STATE_KEYS.context] as Parameters<
        typeof definition.refiner.refine
      >[1],
      state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics] as Parameters<
        typeof definition.refiner.refine
      >[2]
    );

    const result: RefinerNodeResult = {
      [ARTIFACT_PIPELINE_STATE_KEYS.draft]: refinedDraft,
    };
    logNodeExitOk(NODE_NAME, state, currentCriticCount);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err, currentCriticCount);
    throw err;
  }
}

export default refinerNode;
