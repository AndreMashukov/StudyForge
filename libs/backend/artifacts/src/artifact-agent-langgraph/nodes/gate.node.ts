import type { IArtifactAgentDiagnostics } from '@shared-types';
import {
  ARTIFACT_PIPELINE_STATE_KEYS,
  type ArtifactPipelineStateKey,
} from '../../artifact-pipeline-state-keys';
import type { ArtifactAgentDefinition } from '../../artifact-agent/artifact-agent-definition';
import {
  hasBlockerFailures,
  mergeFailuresIntoDiagnostics,
  runArtifactGates,
  type ArtifactGateFailure,
} from '../../artifact-agent/artifact-agent-definition';

/**
 * Subset of the LangGraph pipeline state that the gate node reads.
 *
 * The full state schema lives in `diagram-quiz-state.ts`. The node only
 * touches the keys it needs so this module has no compile-time dependency
 * on the LangGraph `Annotation` types.
 */
export interface GateNodeState {
  [ARTIFACT_PIPELINE_STATE_KEYS.definition]: ArtifactAgentDefinition<unknown, unknown>;
  [ARTIFACT_PIPELINE_STATE_KEYS.context]: unknown;
  [ARTIFACT_PIPELINE_STATE_KEYS.draft]: unknown;
  [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]?: IArtifactAgentDiagnostics;
  [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]?: ArtifactGateFailure[];
  repair_iteration?: number;
}

/**
 * Subset of the state shape the gate node returns. Keys are written through
 * the LangGraph channel system; missing keys keep their existing values.
 */
export interface GateNodeUpdate {
  [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: ArtifactGateFailure[];
  [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: IArtifactAgentDiagnostics;
  repair_iteration: number;
}

const DIAGNOSTICS_KEY = ARTIFACT_PIPELINE_STATE_KEYS.diagnostics satisfies ArtifactPipelineStateKey;
const CONTEXT_KEY = ARTIFACT_PIPELINE_STATE_KEYS.context satisfies ArtifactPipelineStateKey;
const DRAFT_KEY = ARTIFACT_PIPELINE_STATE_KEYS.draft satisfies ArtifactPipelineStateKey;
const DEFINITION_KEY = ARTIFACT_PIPELINE_STATE_KEYS.definition satisfies ArtifactPipelineStateKey;

/**
 * LangGraph node that runs the deterministic artifact gates against the
 * current draft and records the failures.
 *
 * The node mirrors the ADK `GateAgent`:
 *   - Reads the artifact context, current draft, and diagnostics from state.
 *   - Runs `definition.gates` against the draft.
 *   - Merges the resulting failures into diagnostics.
 *   - Writes the failures back to `artifact_gate_failures` so the repair
 *     node can act on them and the conditional edge can route accordingly.
 *
 * In addition to the ADK behavior, this node also increments
 * `repair_iteration` whenever the gates produce failures and the loop has
 * not already exceeded `maxRepairIterations`. The graph uses that counter
 * (not the ADK `escalate` flag) to decide whether to route back to repair.
 */
export async function gateNode(state: GateNodeState): Promise<GateNodeUpdate> {
  const definition = state[DEFINITION_KEY];
  const agentContext = state[CONTEXT_KEY] as Parameters<typeof runArtifactGates>[2];
  const draft = state[DRAFT_KEY];

  if (agentContext === undefined || agentContext === null) {
    throw new Error('Artifact context must be loaded before gate evaluation');
  }
  if (draft === undefined) {
    throw new Error('Artifact draft must be generated before gate evaluation');
  }

  // Preserve diagnostics across nodes. The graph initializes an empty
  // diagnostics object so this should always be present, but default to a
  // defensive shape if it is ever missing.
  const diagnostics: IArtifactAgentDiagnostics =
    state[DIAGNOSTICS_KEY] ??
    ({
      artifactKind: definition.artifactKind,
      agentDefinitionVersion: definition.agentDefinitionVersion,
      orchestrationMode: 'langgraph-runner',
      generatorAttempts: 0,
      repairCount: 0,
      criticCycles: 0,
      modelUsage: [],
      residuals: [],
    } as unknown as IArtifactAgentDiagnostics);

  const gateResult = await runArtifactGates(definition.gates, draft, agentContext);
  mergeFailuresIntoDiagnostics(diagnostics, gateResult.failures);

  const previousIteration = typeof state.repair_iteration === 'number' ? state.repair_iteration : 0;
  const maxRepairIterations = definition.limits.maxRepairIterations;
  const hasBlockers = hasBlockerFailures(gateResult.failures);

  // Only increment when there is something to repair and the loop still has
  // budget remaining. Once we are at or past the cap, the conditional edge
  // will route out of the repair loop on the next evaluation.
  const nextIteration =
    hasBlockers && previousIteration < maxRepairIterations
      ? previousIteration + 1
      : previousIteration;

  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: gateResult.failures,
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
    repair_iteration: nextIteration,
  };
}
