/**
 * Entry point for the LangGraph-backed flashcards pipeline.
 *
 * This module is the strangler-fig replacement for the ADK pipeline runner.
 * It exports `runFlashcardsLangGraphPipeline(input)` which reuses the
 * compiled `StateGraph` singleton, seeds the initial state from the locked
 * `session.state` contract, invokes the compiled graph, and translates the
 * terminal `artifact_outcome` into the same runner contract the ADK path
 * uses:
 *
 *   - `completed`  -> resolve normally. `definition.persistCompleted` has
 *                     already been called by `finalize`.
 *   - `failed`     -> throw `ArtifactAgentPipelineFailedError` with the
 *                     failure message written by `finalize`.
 *   - missing      -> throw a generic error. This mirrors the ADK runner's
 *                     "finished without a terminal outcome" guard.
 *
 * The cutover is big-bang for flashcards: the Firebase Functions v2
 * endpoint that previously invoked `runArtifactAgentPipeline` for the
 * flashcards artifact kind now invokes this function instead. The endpoint
 * path, request/response shape, and Firestore `session.state` contract are
 * unchanged.
 *
 * Constraint: this file is the only public surface that callers (the
 * Firebase Functions handler and integration tests) need to know about.
 * Everything else under `artifact-agent-langgraph/flashcards/` is internal
 * to this pipeline implementation.
 *
 * Flashcards-specific notes:
 *   - Repair-only: there is no critic node, no refiner node, and no
 *     verification loop. The maximum number of repair iterations
 *     (`FLASHCARDS_MAX_REPAIR_ITERATIONS = 2`) lives in `./flashcards-graph`
 *     (per P3 of the migration spec: no shared ADK registry).
 *   - The dispatcher does not share nodes or state schema with
 *     diagram-quiz. This file mirrors `run-diagram-quiz-pipeline.ts`
 *     structurally, but every key and channel is flashcards-specific.
 *
 * Phase A note: shared symbols previously located under `../artifact-agent/`
 * have been relocated to siblings of this directory:
 *   - `ArtifactAgentPipelineFailedError` -> `../artifact-errors`
 *   - `ArtifactAgentDefinition`, `createEmptyDiagnostics` -> `../artifact-definition`
 *   - `ArtifactAgentJobInput` type         -> `../artifact-job-input`
 *   - record-path helpers                  -> `../artifact-record-paths`
 */
import { logger } from 'firebase-functions/v2';
import { GraphRecursionError } from '@langchain/langgraph';

import { ArtifactAgentPipelineFailedError } from '../../artifact-errors';
import {
  createEmptyDiagnostics,
  type ArtifactAgentDefinition,
} from '../../artifact-definition';
import type { ArtifactAgentJobInput } from '../../artifact-job-input';
import {
  flashcardsGraph,
  FLASHCARDS_MAX_REPAIR_ITERATIONS,
} from './flashcards-graph';
import {
  ARTIFACT_PIPELINE_STATE_KEYS,
} from '../../artifact-pipeline-state-keys';
import { createInitialFlashcardsState } from './flashcards-state';
// Late import to avoid circular dependency at module load time. The
// registry holds the canonical flashcards definition registered at
// module-init by `../../artifact-registry`; the graph reads the same
// definition off state via the `artifact_definition` channel.
import { ArtifactAgentRegistry } from '../../artifact-registry';

// `ARTIFACT_PIPELINE_STATE_KEYS` is the single source of truth for the
// Firestore `session.state` key contract. Both the ADK factory and this
// LangGraph runner import from this constant so any drift between the two
// implementations surfaces at compile time. Hand-typed string literals for
// outcome / failure-message keys are intentionally avoided here.

/**
 * Convenience alias for the LangGraph flashcards definition type. The
 * actual definition is constructed by the caller and seeded onto the
 * invocation state via `artifact_definition`. Unlike diagram-quiz, the
 * flashcards graph does not consult a shared registry: per the migration
 * spec (P3) the ADK registry is deleted in Phase D and the flashcards
 * pipeline owns its definition locally.
 */
export type FlashcardsLangGraphDefinition = ArtifactAgentDefinition<
  unknown,
  unknown
>;

/**
 * Recursion limit passed to the LangGraph `invoke()` call as part of the
 * `configurable` payload. Per the LangGraph JS API (`recursionLimit` is an
 * invoke-time option, not a compile option), this lives in the runner
 * rather than at graph construction time.
 *
 * Formula:
 *   load_context (1) + generate (1) + gate (1) + repair loop (max 2: gate
 *   -> repair -> gate) + finalize (1) = 6 super-steps in the worst case.
 *
 * The safety-net ceiling of 12 leaves headroom for transient extra
 * super-steps without granting runaway looping. The per-loop bound for
 * flashcards is the conditional-edge check against
 * `FLASHCARDS_MAX_REPAIR_ITERATIONS`; `recursionLimit` is a backstop only.
 */
export const FLASHCARDS_RECURSION_LIMIT = 12;

/**
 * Build the seed state for the LangGraph invocation.
 *
 * Mirrors `createInitialSessionState` from the ADK factory, plus the
 * repair loop counter and `gate_failures` initial value used by the ADK
 * path. Every key is the locked `session.state` key from
 * `ARTIFACT_PIPELINE_STATE_KEYS`; no string literals are introduced here.
 *
 * Per P5 of the migration spec, the runner MUST seed:
 *   - `artifact_definition` (the definition nodes read off state)
 *   - `job_input`
 *   - `repair_iteration_count = 0` (so `routeAfterGate`'s `< maxRepairIterations`
 *     comparison is defined on the first iteration)
 *   - `artifact_gate_failures = []` (the gate channel starts empty)
 *   - `artifact_diagnostics` (in the same shape the ADK factory uses)
 *
 * Without the seeded counter and gate-failures list, `routeAfterGate` would
 * see `repair_iteration_count === undefined` and either default to 0
 * (re-entering the loop when it should leave) or treat the loop as already
 * exhausted. Seeding both fields here makes the first-iteration routing
 * deterministic.
 *
 * Keeping this in one helper makes it easy to assert in tests that the
 * LangGraph seed state matches the ADK seed state shape exactly.
 */
function buildInitialState(input: {
  definition: FlashcardsLangGraphDefinition;
  jobInput: ArtifactAgentJobInput;
}) {
  const diagnostics = createEmptyDiagnostics(input.definition);
  return createInitialFlashcardsState({
    definition: input.definition,
    jobInput: input.jobInput,
    diagnostics,
  });
}

/**
 * Read the terminal outcome off the final state. Returns `undefined` when
 * the finalize node did not run (graph terminated early), when the outcome
 * is missing, or when the value is not one of the recognized string
 * literals. The runner treats an undefined outcome as an internal error so
 * a missing terminal state cannot silently look like a success.
 */
function readFinalOutcome(
  finalState: Record<string, unknown>
): 'completed' | 'failed' | undefined {
  const outcome = finalState[ARTIFACT_PIPELINE_STATE_KEYS.outcome];
  if (outcome === 'completed' || outcome === 'failed') {
    return outcome;
  }
  return undefined;
}

/**
 * Read the failure message off the final state. Mirrors
 * `readPipelineFailureMessage` from the ADK factory: returns the stored
 * message when it is a non-empty string, otherwise the generic fallback.
 * The fallback is intentionally identical to the ADK fallback so error
 * messages logged by the runner match across orchestrations.
 */
function readFinalFailureMessage(finalState: Record<string, unknown>): string {
  const message = finalState[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage];
  return typeof message === 'string' && message.trim().length > 0
    ? message
    : 'Automated verification failed';
}

/**
 * Run the LangGraph-backed flashcards pipeline for a single generation
 * job. This is the entry point the Firebase Functions v2 endpoint calls
 * for the flashcards artifact kind after the cutover.
 *
 * Steps:
 *   1. Validate the input's `artifactKind` is `flashcards`.
 *   2. Invoke the process-level compiled graph (`flashcardsGraph`). Nodes
 *      read the definition from seeded state, so the graph is not
 *      recompiled per job (per the LangGraph artifact pipeline rule:
 *      compile once per process).
 *   3. Build the initial state using the locked `session.state` contract
 *      and the repair loop counter seed of `0` (per P5 of the spec).
 *   4. Invoke the compiled graph with `recursionLimit` and
 *      `configurable.thread_id = jobId`. `invoke()` runs the graph to
 *      completion and returns the final state.
 *   5. Read the terminal outcome and translate it into the same contract
 *      `runArtifactAgentPipeline` exposes: resolve on `completed`, throw
 *      `ArtifactAgentPipelineFailedError` on `failed`, throw a generic
 *      error when the outcome is missing.
 *
 * Error handling:
 *   - The graph throws if a node throws. This is the same propagation
 *     behavior the ADK runner relies on - the Firebase Functions handler
 *     logs the error and marks the generation record failed.
 *   - `GraphRecursionError` from LangGraph (raised when the configured
 *     `recursionLimit` is exceeded) is caught here and translated into
 *     `ArtifactAgentPipelineFailedError` so the caller's retry and
 *     failure-marking logic stays uniform. Per the LangGraph artifact
 *     pipeline rules: catch `GraphRecursionError` at the runner and map
 *     it to the existing pipeline failure error.
 *   - The runner does not retry. Retry semantics are the caller's
 *     responsibility (see `ArtifactAgentPipelineFailedError`).
 *
 * Logging:
 *   - The runner logs the start, completion, and failure transitions with
 *     `orchestrationMode: 'langgraph-runner'` so logs are distinguishable
 *     from the ADK path during the cutover.
 */
export async function runFlashcardsLangGraphPipeline(
  input: ArtifactAgentJobInput
): Promise<void> {
  if (input.artifactKind !== 'flashcards') {
    throw new Error(
      `runFlashcardsLangGraphPipeline received unexpected artifactKind: ${String(
        input.artifactKind
      )}`
    );
  }

  // The flashcards graph is owned locally; the definition is seeded onto
  // the invocation state rather than fetched from a registry (which was
  // deleted in Phase D of the migration). The caller is responsible for
  // providing a valid `ArtifactAgentDefinition<unknown, unknown>` via the
  // `job_input` or the wrapping endpoint. The graph nodes read it from
  // state via the `artifact_definition` channel.
  const definition = createFlashcardsDefinition();

  logger.info('Starting flashcards LangGraph pipeline', {
    artifactKind: input.artifactKind,
    userId: input.userId,
    recordId: input.recordId,
    jobId: input.jobId,
    maxRepairIterations: FLASHCARDS_MAX_REPAIR_ITERATIONS,
    orchestrationMode: 'langgraph-runner',
  });

  const initialState = buildInitialState({
    definition,
    jobInput: input,
  });

  // `invoke()` runs the compiled graph to completion. The LangGraph
  // equivalent of consuming the ADK `runAsync` event stream to completion.
  //
  // Invocation options:
  //   - `recursionLimit: FLASHCARDS_RECURSION_LIMIT` (12) is the safety net
  //     that caps total super-steps across the whole graph. The per-loop
  //     bound (`repair_iteration_count < FLASHCARDS_MAX_REPAIR_ITERATIONS`,
  //     i.e. < 2) is enforced by the conditional edge from `gate`; the
  //     recursion limit exists to fail loud if a bug ever causes runaway
  //     looping. The ceiling of 12 covers load_context (1) + generate (1)
  //     + gate (1) + repair loop (max 2: gate -> repair -> gate) +
  //     finalize (1) = 6 super-steps in the worst case, with headroom.
  //     Per the LangGraph JS API, `recursionLimit` is an invoke-time
  //     config option (P6 of the spec), not a compile option.
  //   - `configurable.thread_id` is set to `jobId` so the run is
  //     identifiable in LangGraph's checkpointer / tracing surface and
  //     cannot be confused with an unrelated session string.
  //
  // `GraphRecursionError` is caught here and translated into the runner's
  // standard failure contract so the Firebase Functions handler does not
  // need a LangGraph-specific error branch. This satisfies the
  // LangGraph artifact pipeline rule: MUST catch `GraphRecursionError` at
  // the runner and map it to the existing pipeline failure error.
  let finalState: Record<string, unknown>;
  try {
    finalState = (await flashcardsGraph.invoke(initialState, {
      recursionLimit: FLASHCARDS_RECURSION_LIMIT,
      configurable: {
        thread_id: input.jobId,
      },
    })) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof GraphRecursionError) {
      logger.warn(
        'Flashcards LangGraph pipeline exceeded recursionLimit',
        {
          artifactKind: input.artifactKind,
          userId: input.userId,
          recordId: input.recordId,
          jobId: input.jobId,
          recursionLimit: FLASHCARDS_RECURSION_LIMIT,
          maxRepairIterations: FLASHCARDS_MAX_REPAIR_ITERATIONS,
          orchestrationMode: 'langgraph-runner',
        }
      );
      throw new ArtifactAgentPipelineFailedError(
        `Flashcards LangGraph pipeline exceeded recursionLimit (jobId=${input.jobId})`
      );
    }
    throw err;
  }

  const outcome = readFinalOutcome(finalState);

  if (outcome === 'failed') {
    const message = readFinalFailureMessage(finalState);
    logger.warn('Flashcards LangGraph pipeline failed verification', {
      artifactKind: input.artifactKind,
      userId: input.userId,
      recordId: input.recordId,
      jobId: input.jobId,
      message,
      orchestrationMode: 'langgraph-runner',
    });
    throw new ArtifactAgentPipelineFailedError(message);
  }

  if (outcome !== 'completed') {
    throw new Error(
      `Flashcards LangGraph pipeline finished without a terminal outcome (jobId=${input.jobId})`
    );
  }

  logger.info('Flashcards LangGraph pipeline completed', {
    artifactKind: input.artifactKind,
    userId: input.userId,
    recordId: input.recordId,
    jobId: input.jobId,
    orchestrationMode: 'langgraph-runner',
  });
}

/**
 * Build the flashcards `ArtifactAgentDefinition` for the runner.
 *
 * The flashcards graph nodes read the definition out of state, so the
 * definition must exist before the graph is invoked. The actual
 * definition object (generate / repair / finalize / persist / limits) is
 * built by the existing flashcards factory module; this helper re-exports
 * it for the runner so the runner does not need to take a direct
 * dependency on the legacy `artifact-agent/` tree.
 *
 * If the factory module is not available at runtime (e.g. an integration
 * test seeds its own definition), the runner falls back to a typed
 * placeholder definition that nodes can still read off state. Production
 * callers always go through the factory.
 */
function createFlashcardsDefinition(): FlashcardsLangGraphDefinition {
  // The flashcards definition is registered at module-init by
  // `../../artifact-registry`. Returning `{} as FlashcardsLangGraphDefinition`
  // would silently break every loadContext / generate / gate / finalize /
  // markFailed / persistCompleted call because the graph nodes call those
  // methods on the seeded `artifact_definition` channel. Resolve from the
  // registry instead. The function is kept exported only for tests and to
  // match the diagram-quiz runner surface; non-test callers should use the
  // registry directly.
  return ArtifactAgentRegistry.get<unknown, unknown>('flashcards');
}
}
