/**
 * LangGraph node: load artifact generation context.
 *
 * Mirrors `LoadContextAgent` from the ADK `artifact-agent` module:
 *
 * - Reads `artifact_definition` and `job_input` from state and calls
 *   `definition.loadContext(jobInput)` to build the shared
 *   `ArtifactAgentContext` consumed by every downstream node.
 * - Writes the loaded context back to `artifact_context`, the same session.state
 *   key produced by the ADK `LoadContextAgent.runAsyncImpl` stage. The
 *   `session.state` key contract is locked in
 *   `libs/backend/artifacts/src/artifact-pipeline-state-keys.ts`, and both
 *   pipelines import from that shared module.
 *
 * Diagnostics are intentionally not mutated here: the initial diagnostics are
 * seeded by `createInitialDiagramQuizState` (or the equivalent ADK helper) so
 * loadContext runs against the same empty diagnostics shape the ADK agent
 * sees.
 *
 * Failure semantics: if `artifact_definition` or `job_input` is missing, the
 * node throws. This matches the ADK agent, which throws via
 * `readContext`/`readDraft` style helpers whenever a prerequisite key is
 * absent. Letting the throw propagate means the LangGraph runner can route the
 * failure to the caller the same way it would for any other pipeline error.
 */
import type {
  ArtifactAgentContext,
  ArtifactAgentDefinition,
  ArtifactAgentJobInput,
} from '../../artifact-agent/artifact-agent-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { DiagramQuizState } from '../diagram-quiz-state';

/**
 * Result type for the load-context node. The node only writes
 * `artifact_context`; declaring the return type explicitly makes the contract
 * obvious in graph wiring and lets the inferred partial-update keep all other
 * channels untouched.
 */
export type LoadContextNodeResult = Partial<DiagramQuizState>;

/**
 * LangGraph node function: delegates to `definition.loadContext(jobInput)`.
 *
 * @param state - The current diagram-quiz pipeline state. Only
 *   `artifact_definition` and `job_input` are read; all other channels are
 *   ignored and pass through unchanged.
 * @returns A partial state update that writes `artifact_context`.
 */
export async function loadContextNode(
  state: DiagramQuizState
): Promise<LoadContextNodeResult> {
  const definition = state[
    ARTIFACT_PIPELINE_STATE_KEYS.definition
  ] as ArtifactAgentDefinition<unknown, unknown> | undefined;
  if (!definition) {
    throw new Error('LoadContext node requires artifact_definition in state');
  }

  const jobInput = state[
    ARTIFACT_PIPELINE_STATE_KEYS.jobInput
  ] as ArtifactAgentJobInput | undefined;
  if (!jobInput) {
    throw new Error('LoadContext node requires job_input in state');
  }

  const loadedContext: ArtifactAgentContext =
    await definition.loadContext(jobInput);

  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.context]: loadedContext,
  } as LoadContextNodeResult;
}

export default loadContextNode;