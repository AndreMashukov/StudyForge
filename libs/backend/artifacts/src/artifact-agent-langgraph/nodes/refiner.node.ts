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
  state: typeof DiagramQuizStateValue.State,
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
    // The verification loop starts at `refiner` (gate -> refiner -> critic).
    // On first entry there is no critic result yet. Match the ADK
    // `RefinerAgent`, which returned without changing the draft when critic
    // findings were empty, then continue to `critic`.
    //
    // Skip refinement for terminal verdicts too. The ADK `RefinerAgent` is a
    // no-op for both 'fail' (do not overwrite a draft the critic already
    // rejected) and 'pass' (no revision needed). The LangGraph port must
    // match that contract so the verification loop converges when the
    // critic reaches a terminal verdict instead of clobbering the draft.
    if (
      !criticResult ||
      criticResult.overallVerdict === 'fail' ||
      criticResult.overallVerdict === 'pass'
    ) {
      const result = {
        [ARTIFACT_PIPELINE_STATE_KEYS.draft]: draft,
      } as RefinerNodeResult;
      logNodeExitOk(NODE_NAME, state);
      return result;
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
        >[3],
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
