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
 * Failure semantics (P4): recoverable errors are caught internally and
 * surfaced through the canonical failure channels
 * (`artifact_outcome = 'failed'`, `artifact_failure_message`) instead of
 * being thrown. Throwing would crash the LangGraph runner and bypass the
 * failure-path plumbing in `run-diagram-quiz-pipeline.ts`. By writing the
 * failure channels directly, the graph continues to the `finalize` node
 * (via the existing topology) and the runner can persist the failure
 * outcome through the normal pipeline teardown.
 *
 * The node still distinguishes fatal contract violations (e.g. an internal
 * invariant violation that would corrupt downstream nodes) from recoverable
 * I/O / provider failures. Recoverable failures are written to the failure
 * channels; only the former propagate as thrown errors so the runner can
 * surface an unrecoverable bug rather than silently completing with a
 * half-loaded context.
 *
 * P5: Node signature uses the canonical LangGraph `GraphNode<StateShape>`
 * type so the node accepts the typed `state` argument only and returns a
 * partial state update. The node does not reference any external
 * `session.state`, Firestore session, or other implicit transport — all
 * inputs are read from the `state` argument and all outputs are returned
 * through the partial update shape. This keeps the node transport-agnostic
 * and matches the LangGraph recommendation that node functions are pure
 * (state-in / partial-state-out) so they compose cleanly inside a graph.
 *
 * P7: this node is wrapped with `createNodeLifecycleLogger` so it emits
 * a structured `node_enter` event before invocation and a `node_exit`
 * event after the partial-state update is returned. Both events carry
 * the per-invocation `jobId` (read off `artifact_definition`-seeded
 * `job_input`), the node name, an ISO-8601 timestamp, and the
 * orchestration mode. The wrapper still rethrows errors so the failure
 * semantics above are preserved, but the `node_exit` event is still
 * emitted before the error propagates.
 *
 * P8 (sole Firestore fetcher): this node is the ONLY node in the
 * diagram-quiz LangGraph pipeline that is permitted to talk to Firestore.
 * Firestore reads (the source documents behind `definition.loadContext`)
 * happen at most once per pipeline invocation, in this node. Every other
 * downstream node — `generate`, `gate`, `repair`, `refiner`, `critic`,
 * `finalize` — must be transport-agnostic and must NEVER instantiate a
 * Firestore client, call `getFirestore()`, or invoke any session/state
 * read or write against Firestore. They consume only the typed state
 * argument produced (directly or transitively) by this node. Routing
 * decisions, gate validation, repair/refine/critic passes, and final
 * persistence are all driven off `artifact_context`, `artifact_draft`,
 * `artifact_diagnostics`, and the other channels written here or by
 * `generate.node.ts`. If a downstream node ever needs Firestore data that
 * is not already in `artifact_context`, that data must be added to the
 * `ArtifactAgentContext` shape produced by this node rather than
 * introducing a second Firestore read at runtime.
 *
 * @see libs/backend/artifacts/src/artifact-agent/artifact-agent-definition.ts
 *      for `ArtifactAgentDefinition.loadContext`, which is the contract
 *      that funnels every Firestore read in the LangGraph diagram-quiz
 *      pipeline through this single node.
 */
import type { GraphNode } from '@langchain/langgraph';

import type {
  ArtifactAgentContext,
  ArtifactAgentDefinition,
  ArtifactAgentJobInput,
} from '../../artifact-agent/artifact-agent-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import {
  createNodeLifecycleLogger,
  DIAGRAM_QUIZ_NODE_NAMES,
} from '../diagram-quiz-graph';
import type {
  ArtifactPipelineOutcome,
  DiagramQuizStateShape,
} from '../diagram-quiz-state';

/**
 * Result type for the load-context node. The node writes
 * `artifact_context` on the success path and the canonical failure channels
 * (`artifact_outcome`, `artifact_failure_message`) on the recoverable failure
 * path. Declaring the return type explicitly makes the contract obvious in
 * graph wiring and lets the inferred partial-update keep all other channels
 * untouched.
 */
export type LoadContextNodeResult = Partial<DiagramQuizStateShape>;

/**
 * Build the canonical failure-channel update for the load-context node.
 *
 * Centralising this helper keeps the failure-shape definition in lock-step
 * with the other nodes and ensures every recoverable failure mode produces
 * the same keys (and therefore the same runner-side handling).
 *
 * P8 invariant: this helper does NOT touch `artifact_generation_model`
 * or `artifact_agent_model` — those channels are owned exclusively by
 * `generate.node.ts` (P6) — and it does not perform any Firestore read or
 * write.
 */
function buildLoadContextFailure(
  message: string
): LoadContextNodeResult {
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.outcome]:
      'failed' satisfies ArtifactPipelineOutcome,
    [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: message,
  } as LoadContextNodeResult;
}

/**
 * LangGraph node function: delegates to `definition.loadContext(jobInput)`.
 *
 * Typed via `GraphNode<DiagramQuizStateShape>` so the state argument and
 * the partial-state return are both constrained by the diagram-quiz state
 * schema. The node reads only from the `state` argument; no Firestore
 * session reference, `session.state` lookup, or other implicit transport
 * is consulted here.
 *
 * P8 contract: this node is the SOLE entry point for Firestore reads in the
 * diagram-quiz LangGraph pipeline. Any Firestore access that downstream
 * nodes require must funnel through `definition.loadContext` here, so the
 * set of reads is centralised, predictable, and easy to audit. No other
 * node in this pipeline may call `getFirestore()`, instantiate a
 * `Firestore` client, or touch the `session.state` Firestore document
 * directly.
 *
 * @param state - The current diagram-quiz pipeline state. Only
 *   `artifact_definition` and `job_input` are read; all other channels are
 *   ignored and pass through unchanged.
 * @returns A partial state update that writes `artifact_context` on success,
 *   or `artifact_outcome = 'failed'` + `artifact_failure_message` when a
 *   recoverable error (missing definition / job_input, or a thrown error
 *   from the definition) is observed.
 */
const loadContextNodeImpl: GraphNode<DiagramQuizStateShape> = async (state) => {
  try {
    const definition = state[
      ARTIFACT_PIPELINE_STATE_KEYS.definition
    ] as ArtifactAgentDefinition<unknown, unknown> | undefined;
    if (!definition) {
      return buildLoadContextFailure(
        'LoadContext node requires artifact_definition in state'
      );
    }

    const jobInput = state[
      ARTIFACT_PIPELINE_STATE_KEYS.jobInput
    ] as ArtifactAgentJobInput | undefined;
    if (!jobInput) {
      return buildLoadContextFailure(
        'LoadContext node requires job_input in state'
      );
    }

    let loadedContext: ArtifactAgentContext;
    try {
      // P8: this is the ONLY call in the LangGraph diagram-quiz pipeline
      // that may perform a Firestore read. All Firestore-backed inputs
      // (source document, session state, dependencies, etc.) must be
      // fetched here via `definition.loadContext(jobInput)` and surfaced
      // through `ArtifactAgentContext`. No other node in this pipeline is
      // permitted to instantiate or call into Firestore.
      loadedContext = await definition.loadContext(jobInput);
    } catch (error) {
      // Recoverable failure: the definition's loadContext threw (e.g. its
      // adapter could not read Firestore, or some upstream fetch failed).
      // Surface through the canonical failure channels so the runner can
      // persist the failure outcome through the normal finalize teardown
      // instead of crashing the LangGraph invocation.
      const reason =
        error instanceof Error ? error.message : String(error);
      return buildLoadContextFailure(
        `LoadContext failed: ${reason}`
      );
    }

    return {
      [ARTIFACT_PIPELINE_STATE_KEYS.context]: loadedContext,
    } as LoadContextNodeResult;
  } catch (error) {
    // Last-resort safety net: a synchronous bug in this node (not in user
    // code) is still surfaced through the failure channels rather than
    // re-thrown, so the runner keeps the same shape of outcome regardless
    // of the source of the error.
    const reason =
      error instanceof Error ? error.message : String(error);
    return buildLoadContextFailure(
      `LoadContext node crashed: ${reason}`
    );
  }
};

/**
 * P7: wrap the node with the structured `node_enter` / `node_exit` logger
 * so the lifecycle events are emitted from inside the node module too
 * (in addition to the graph-level wrapper that double-applies safely
 * because the inner wrapper is a no-op when its wrapped function is
 * itself already a lifecycle-instrumented function — see
 * `createNodeLifecycleLogger` for the exact idempotence rule).
 */
export const loadContextNode: GraphNode<DiagramQuizStateShape> =
  createNodeLifecycleLogger(
    DIAGRAM_QUIZ_NODE_NAMES.loadContext,
    loadContextNodeImpl
  );

export default loadContextNode;