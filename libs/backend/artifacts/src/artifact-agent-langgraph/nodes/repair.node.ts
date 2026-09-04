/**
 * Repair node for the diagram-quiz LangGraph pipeline.
 *
 * Mirrors `RepairAgent` from the ADK `artifact-agent` module:
 *
 * - Calls `definition.repair.repair(draft, failures, context, diagnostics)`
 *   against the latest draft and writes the repaired draft back to
 *   `artifact_draft`. This is the same session.state key consumed downstream
 *   by the gate, refiner, critic, and finalize nodes.
 * - Increments `diagnostics.repairCount` so the diagnostic trail reflects
 *   each repair attempt, matching the ADK behavior.
 *
 * Loop-guard semantics:
 * - The bounded-loop guard itself lives on the `gate` node and on the
 *   conditional edge that follows it. The repair node is intentionally a
 *   single iteration: the conditional edge decides whether to route back
 *   into this node (when failures persist and `repair_iteration` has not
 *   exceeded `maxRepairIterations`) or forward into `refiner` (when the
 *   loop bound has been hit). This mirrors how ADK's `LoopAgent` with
 *   `maxIterations = N` invokes `[GateAgent, RepairAgent]` up to N times.
 *
 * No-op conditions (matching ADK `RepairAgent.runAsyncImpl`):
 * - `definition.repair` is missing. The graph wiring skips the verification
 *   loop in that case; the repair node itself stays defensive.
 * - `state.artifact_gate_failures` contains no blockers (`hasBlockerFailures`
 *   returns false). The repair strategy must only be invoked when there is
 *   something to repair; otherwise the draft is left untouched.
 */
import type {
  ArtifactAgentContext,
  ArtifactAgentDefinition,
  ArtifactGateFailure,
} from '../../artifact-agent/artifact-agent-definition';
import { hasBlockerFailures } from '../../artifact-agent/artifact-agent-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { IArtifactAgentDiagnostics } from '@shared-types';
import type {
  DiagramQuizNodeState,
  DiagramQuizNodeUpdate,
} from './refiner.node';

export interface RepairNodeResult extends DiagramQuizNodeUpdate {
  [ARTIFACT_PIPELINE_STATE_KEYS.draft]: unknown;
  [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: IArtifactAgentDiagnostics;
}

/**
 * Repair the current draft against the latest gate failures, or no-op when
 * no repair strategy is configured or the failures contain no blockers.
 */
export async function repairNode(
  state: DiagramQuizNodeState
): Promise<RepairNodeResult | DiagramQuizNodeUpdate> {
  const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition] as
    | ArtifactAgentDefinition<unknown, unknown>
    | undefined;
  if (!definition) {
    throw new Error('Artifact definition must be present in state before repair');
  }

  const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
  if (draft === undefined) {
    throw new Error('Artifact draft must be generated before repair');
  }

  const gateFailures = (state[ARTIFACT_PIPELINE_STATE_KEYS.gateFailures] ?? []) as
    ArtifactGateFailure[];

  const agentContext = state[ARTIFACT_PIPELINE_STATE_KEYS.context] as
    | ArtifactAgentContext
    | undefined;
  if (!agentContext) {
    throw new Error('Artifact context must be loaded before repair');
  }

  const diagnostics = state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics] as
    | IArtifactAgentDiagnostics
    | undefined;
  if (!diagnostics) {
    throw new Error('Artifact diagnostics must be present before repair');
  }

  if (!definition.repair || !hasBlockerFailures(gateFailures)) {
    // Mirror the ADK RepairAgent: a missing repair strategy or non-blocker
    // failures means the loop should exit naturally. The conditional edge
    // after `gate` will route back to `gate` (or forward to `refiner`) based
    // on `repair_iteration` and the freshly-computed gate failures.
    return {};
  }

  const repairedDraft = await definition.repair.repair(
    draft,
    gateFailures,
    agentContext,
    diagnostics
  );

  const nextDiagnostics: IArtifactAgentDiagnostics = {
    ...diagnostics,
    repairCount: (diagnostics.repairCount ?? 0) + 1,
  };

  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.draft]: repairedDraft,
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: nextDiagnostics,
  };
}

export default repairNode;
