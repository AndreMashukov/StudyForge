/** LangGraph node: finalize the artifact and set the terminal outcome. */
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type {
  ArtifactAgentFailure,
  ArtifactAgentResult,
} from '../../artifact-agent/artifact-agent-definition';
import type { DiagramQuizState } from '../diagram-quiz-state';
import { DiagramQuizStateValue } from '../diagram-quiz-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'finalize';

export type FinalizeNodeResult = Partial<DiagramQuizState>;

/**
 * LangGraph node: finalize the artifact and set the terminal outcome.
 *
 * Reads `artifact_outcome` from state and dispatches to the ADK definition's
 * `persistCompleted` or `markFailed` callback. The strategy-object callbacks
 * (`critic`, `refiner`, `repair`) are NOT called here — they were already
 * invoked by their respective nodes during the verification and repair loops.
 *
 * The finalize node does NOT write `artifact_generation_model` or
 * `artifact_agent_model`. Those keys are set exclusively by `generate.node.ts`
 * and persist across the run so downstream persistence can read either field.
 * See the P6 audit fix.
 *
 * Emits `node_enter` and `node_exit` structured log lines with `jobId`.
 */
export async function finalizeNode(
  state: typeof DiagramQuizStateValue.State
): Promise<FinalizeNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
    if (!definition) {
      throw new Error('Finalize node requires artifact_definition in state');
    }

    const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context];
    if (!context) {
      throw new Error('Finalize node requires artifact_context in state');
    }

    const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
    const diagnostics = state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics];
    const outcome = state[ARTIFACT_PIPELINE_STATE_KEYS.outcome];
    const failureMessage = state[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage];
    const generationModel = state[ARTIFACT_PIPELINE_STATE_KEYS.generationModel];
    const agentModel = state[ARTIFACT_PIPELINE_STATE_KEYS.agentModel];

    // Derive the terminal outcome from the state routing produced, not
    // from a default. The conditional edges route to finalize when the
    // loop bounds are exhausted (with blockers or a non-pass critic
    // verdict still present), or when a node wrote `outcome: 'failed'`.
    // No node in the repair or critic loop writes `outcome = 'failed'`
    // on budget exhaustion; detect that case here so a draft that still
    // holds blocker gate failures is not persisted as a successful
    // artifact.
    const gateFailures =
      state[ARTIFACT_PIPELINE_STATE_KEYS.gateFailures] ?? [];
    const hasBlockers = gateFailures.some(
      (failure) => failure.severity === 'blocker'
    );
    const criticResult = state[ARTIFACT_PIPELINE_STATE_KEYS.criticResult];
    const criticBlocked =
      criticResult !== undefined &&
      (criticResult.overallVerdict === 'fail' ||
        criticResult.items.some((item) => item.severity === 'blocker'));
    const shouldFail =
      outcome === 'failed' ||
      draft === undefined ||
      diagnostics === undefined ||
      hasBlockers ||
      criticBlocked;
    const resolvedFailureMessage =
      failureMessage ??
      (hasBlockers
        ? 'Gate blockers remained after the repair loop finished'
        : criticBlocked
          ? 'Critic rejected the artifact'
          : draft === undefined
            ? 'Artifact draft was not produced'
            : 'Diagram-quiz pipeline failed without a message');

    if (shouldFail) {
      const failure: ArtifactAgentFailure = {
        context: context as ArtifactAgentFailure['context'],
        message: resolvedFailureMessage,
        diagnostics: diagnostics as ArtifactAgentFailure['diagnostics'],
      };
      await definition.markFailed(failure);
    } else {
      const result: ArtifactAgentResult<unknown> = {
        context: context as ArtifactAgentResult<unknown>['context'],
        draft,
        diagnostics: diagnostics as ArtifactAgentResult<unknown>['diagnostics'],
        generationModel: generationModel ?? '',
        agentModel: agentModel ?? '',
      };
      await definition.persistCompleted(result);
    }

    const nodeResult = {
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: shouldFail
        ? ('failed' as const)
        : ('completed' as const),
      [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: shouldFail
        ? resolvedFailureMessage
        : null,
    } as FinalizeNodeResult;
    logNodeExitOk(NODE_NAME, state);
    return nodeResult;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    throw err;
  }
}

export default finalizeNode;
