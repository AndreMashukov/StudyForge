import type { IArtifactAgentDiagnostics, IArtifactCriticResult } from '@shared-types';
import type {
  ArtifactAgentContext,
  ArtifactAgentDefinition,
  ArtifactGateFailure,
} from '../../artifact-agent/artifact-agent-definition';
import {
  hasBlockerFailures,
  mergeFailuresIntoDiagnostics,
  runArtifactGates,
} from '../../artifact-agent/artifact-agent-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { ArtifactPipelineOutcome } from '../diagram-quiz-state';

/**
 * State shape consumed by the finalize node.
 *
 * Mirrors the channels read and written by the ADK `FinalizeAgent`:
 *   - Reads the latest `artifact_definition`, `artifact_context`,
 *     `artifact_draft`, `artifact_diagnostics`, `artifact_critic_result`,
 *     `artifact_generation_model`, and `artifact_agent_model`.
 *   - Writes `artifact_outcome`, `artifact_failure_message`, and merges
 *     `artifact_diagnostics` with any novel gate residuals discovered on the
 *     final pass.
 */
export interface FinalizeNodeState {
  [ARTIFACT_PIPELINE_STATE_KEYS.definition]:
    | ArtifactAgentDefinition<unknown, unknown>
    | undefined;
  [ARTIFACT_PIPELINE_STATE_KEYS.context]: ArtifactAgentContext | undefined;
  [ARTIFACT_PIPELINE_STATE_KEYS.draft]: unknown;
  [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]?: IArtifactAgentDiagnostics;
  [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]?: IArtifactCriticResult;
  [ARTIFACT_PIPELINE_STATE_KEYS.generationModel]?: string;
  [ARTIFACT_PIPELINE_STATE_KEYS.agentModel]?: string;
  [ARTIFACT_PIPELINE_STATE_KEYS.outcome]?: ArtifactPipelineOutcome;
  [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]?: string;
}

/**
 * Result shape returned by the finalize node. LangGraph merges these channels
 * back into the graph state; `artifact_outcome` and `artifact_failure_message`
 * are the terminal signals the runner reads to decide whether the pipeline
 * succeeded.
 */
export type FinalizeNodeResult = Partial<{
  [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: IArtifactAgentDiagnostics;
  [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: ArtifactPipelineOutcome;
  [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: string;
}>;

/**
 * Pick a human-readable failure message from the critic result, if any.
 *
 * Mirrors the ADK `readCriticFailureMessage` helper. Preference order:
 *   1. The first blocker item's first non-empty issue text, prefixed with the
 *      1-based item index so the user can locate the failing item.
 *   2. A generic "critic flagged a blocker" message when the blocker carries
 *      no issue text.
 *   3. The "Critic rejected the artifact" message when the overall verdict is
 *      `fail` but no specific blocker item exists.
 *   4. `undefined` when the critic result is missing or the verdict is
 *      something other than `fail`/blocker.
 */
function readCriticFailureMessage(
  criticResult: IArtifactCriticResult | undefined
): string | undefined {
  if (!criticResult) {
    return undefined;
  }

  const items = Array.isArray(criticResult.items) ? criticResult.items : [];
  const blocker = items.find((item) => item.severity === 'blocker');
  if (blocker) {
    const issues = Array.isArray(blocker.issues) ? blocker.issues : [];
    const issue = issues.find((text) => text && text.trim().length > 0);
    if (issue) {
      return `Question ${blocker.itemIndex + 1}: ${issue}`;
    }
    return `Question ${blocker.itemIndex + 1}: critic flagged a blocker`;
  }

  if (criticResult.overallVerdict === 'fail') {
    return 'Critic rejected the artifact';
  }

  return undefined;
}

/**
 * Determine whether a gate failure has already been recorded as a residual.
 *
 * The finalize pass re-runs gates against the latest draft. GateAgent has
 * already appended residuals to `diagnostics.residuals` during the repair
 * loop, so we dedup by comparing the four fields the ADK pipeline uses to
 * define identity (gateId, severity, message, path). Without dedup, every
 * retry would double-count every blocker.
 */
function isAlreadyRecorded(
  diagnostics: IArtifactAgentDiagnostics,
  failure: ArtifactGateFailure
): boolean {
  const residuals: ReadonlyArray<ArtifactGateFailure> = Array.isArray(
    diagnostics.residuals
  )
    ? diagnostics.residuals
    : [];
  return residuals.some(
    (residual: ArtifactGateFailure) =>
      residual.gateId === failure.gateId &&
      residual.severity === failure.severity &&
      residual.message === failure.message &&
      residual.path === failure.path
  );
}

/**
 * Pick the failure message for the failure branch.
 *
 * Preference order (mirrors ADK FinalizeAgent exactly):
 *   1. The first novel blocker message from the freshly-computed gate result.
 *      Only novel blockers are surfaced so we don't repeat residual failures
 *      that already triggered repair attempts.
 *   2. Any blocker message from the freshly-computed gate result, regardless
 *      of novelty. The ADK pipeline surfaces the blocker that is actually
 *      present on the final draft so the user gets a precise error.
 *   3. A critic-derived message (`readCriticFailureMessage`).
 *   4. The generic "Automated verification failed" fallback when neither
 *      source produced a message.
 */
function pickFailureMessage(
  novelBlockerFailures: ArtifactGateFailure[],
  gateFailures: ArtifactGateFailure[],
  criticResult: IArtifactCriticResult | undefined
): string {
  const novelBlockerMessage = novelBlockerFailures.find(
    (failure) => failure.severity === 'blocker'
  )?.message;
  if (novelBlockerMessage) {
    return novelBlockerMessage;
  }

  const anyBlockerMessage = gateFailures.find(
    (failure) => failure.severity === 'blocker'
  )?.message;
  if (anyBlockerMessage) {
    return anyBlockerMessage;
  }

  return (
    readCriticFailureMessage(criticResult) || 'Automated verification failed'
  );
}

/**
 * Compute the set of gate failures that are novel relative to the residuals
 * already recorded by prior stages. Only these failures are merged into
 * `diagnostics.residuals` because old residual failures must not double-count.
 *
 * "Novel" here means the (gateId, severity, message, path) tuple is not yet
 * present in `diagnostics.residuals`. GateAgent appended residuals on every
 * repair pass, so a fresh run after refiner might surface failures the gate
 * had already seen and merged. Those do not count as novel.
 */
function findNovelFailures(
  diagnostics: IArtifactAgentDiagnostics,
  gateFailures: ArtifactGateFailure[]
): ArtifactGateFailure[] {
  return gateFailures.filter((failure) => !isAlreadyRecorded(diagnostics, failure));
}

/**
 * Determine whether the critic result indicates a blocking failure.
 *
 * Mirrors the ADK FinalizeAgent predicate: a critic result blocks completion
 * when its overall verdict is `fail` OR any of its items are blockers.
 */
function isCriticBlocking(
  criticResult: IArtifactCriticResult | undefined
): boolean {
  if (!criticResult) {
    return false;
  }
  if (criticResult.overallVerdict === 'fail') {
    return true;
  }
  const items = Array.isArray(criticResult.items) ? criticResult.items : [];
  return items.some((item) => item.severity === 'blocker');
}

/**
 * Finalize node for the LangGraph diagram-quiz pipeline.
 *
 * Behavior (mirrors the ADK `FinalizeAgent`):
 *   - Re-runs `definition.gates` against the latest draft. Only novel failures
 *     (i.e. failures whose gateId/severity/message/path tuple is not already
 *     recorded in `diagnostics.residuals`) are appended. Old residual
 *     failures must not double-count.
 *   - Treats the artifact as failed when a NOVEL blocker is present in the
 *     freshly-computed gate result OR the critic reported a `fail` verdict
 *     OR the critic recorded any blocker item. Per the spec, only novel
 *     gate failures count as blocking - residual blockers from earlier passes
 *     that the gate keeps re-emitting do not cause a fresh failure on the
 *     finalize pass (they were already counted in the diagnostics trail and
 *     the loop either converged or hit `maxRepairIterations` and exited).
 *   - On failure, calls `definition.markFailed(...)` and writes
 *     `artifact_outcome = 'failed'` plus an `artifact_failure_message`
 *     derived from the first blocking gate failure, the critic message, or
 *     a generic fallback.
 *   - On success, calls `definition.persistCompleted(...)` with the latest
 *     draft, diagnostics, and the recorded generation/agent model labels,
 *     and writes `artifact_outcome = 'completed'`.
 *   - Writes `artifact_outcome` and (on failure) `artifact_failure_message`.
 *
 * The graph's outgoing edge from `finalize` always terminates at `END`, so
 * this node is responsible for the side effects (Firestore writes via
 * `persistCompleted` or `markFailed`) that the ADK `FinalizeAgent` performed
 * inline. Either persistence call may throw; the LangGraph runner surfaces
 * that to the caller.
 */
export async function finalizeNode(
  state: FinalizeNodeState
): Promise<FinalizeNodeResult> {
  const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
  if (!definition) {
    throw new Error(
      'Artifact definition must be present in state before the finalize node runs'
    );
  }

  const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context];
  if (!context) {
    throw new Error(
      'Artifact context must be loaded before the finalize node runs'
    );
  }

  const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
  if (draft === undefined) {
    throw new Error(
      'Artifact draft must be present in state before the finalize node runs'
    );
  }

  const diagnostics = state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics];
  if (!diagnostics) {
    throw new Error(
      'Artifact diagnostics must be present in state before the finalize node runs'
    );
  }

  const criticResult = state[ARTIFACT_PIPELINE_STATE_KEYS.criticResult];
  const generationModel = state[ARTIFACT_PIPELINE_STATE_KEYS.generationModel];
  const agentModel = state[ARTIFACT_PIPELINE_STATE_KEYS.agentModel];

  // Re-run gates against the final draft. This mirrors the ADK FinalizeAgent,
  // which re-validates after the repair and (if enabled) verification loops
  // have produced their latest draft. The gate result is computed against
  // the live draft in full - dedup happens after, against the residuals
  // already recorded by GateAgent during the repair loop.
  const gateResult = await runArtifactGates(definition.gates, draft, context);

  // Dedup against residuals already recorded. Only failures we have not seen
  // before (e.g. introduced by the refiner) are appended. Old residual
  // failures must not double-count.
  const novelFailures = findNovelFailures(diagnostics, gateResult.failures);
  if (novelFailures.length > 0) {
    mergeFailuresIntoDiagnostics(diagnostics, novelFailures);
  }

  // Per the spec, only NOVEL gate failures are blocking. Residual blockers
  // from earlier repair passes that the gate still emits are not a fresh
  // failure - the loop either converged on them or was capped and exited,
  // and the diagnostics trail already records them. We still consult the
  // full gate result for the failure message, since the user wants to know
  // what's actually wrong with the final draft.
  const novelBlockers = novelFailures.filter(
    (failure) => failure.severity === 'blocker'
  );
  const gateBlocked = novelBlockers.length > 0;
  const criticBlocked = isCriticBlocking(criticResult);

  if (gateBlocked || criticBlocked) {
    const failureMessage = pickFailureMessage(
      novelBlockers,
      gateResult.failures,
      criticResult
    );

    await definition.markFailed({
      context,
      diagnostics,
      message: failureMessage,
    });

    return {
      [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]:
        'failed' satisfies ArtifactPipelineOutcome,
      [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: failureMessage,
    };
  }

  await definition.persistCompleted({
    context,
    draft,
    diagnostics,
    generationModel,
    agentModel,
  });

  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
    [ARTIFACT_PIPELINE_STATE_KEYS.outcome]:
      'completed' satisfies ArtifactPipelineOutcome,
  };
}

export default finalizeNode;
