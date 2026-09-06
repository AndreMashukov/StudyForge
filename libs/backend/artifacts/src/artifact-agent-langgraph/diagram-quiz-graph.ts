/**
 * LangGraph `StateGraph` wiring for the diagram-quiz artifact pipeline.
 *
 * This file is the structural counterpart to the ADK `SequentialAgent` graph
 * described in the migration spec. It encodes the same topology:
 *
 *   START -> load_context -> generate -> gate
 *
 * Repair loop:
 *   gate -> repair -> gate   (conditional edge from `gate` selects next node)
 *   Exit condition:
 *     - no blocker gate failures remain (warnings alone do not keep looping), OR
 *     - repair_iteration exceeds maxRepairIterations (4)
 *
 * Verification loop (only if both `definition.critic` and `definition.refiner`
 * are present; diagram-quiz always satisfies both):
 *   refiner -> critic -> refiner  (conditional edge from `critic` selects next node)
 *   Exit condition:
 *     - critic verdict is 'pass', OR
 *     - critic_iteration exceeds maxCriticIterations (2)
 *
 * Terminal:
 *   refiner|critic|gatelloop_exit -> finalize -> END
 *
 * The graph is intentionally generic over the definition type. The actual
 * `ArtifactAgentDefinition<TDraft, TPayload>` is stored on the state via
 * `artifact_definition` and is read out by each node. This keeps the node
 * functions free of pipeline structure concerns.
 *
 * Routing is wired with `addConditionalEdges` (P2): the `gate` and `critic`
 * nodes write their results to state and return; the conditional edges
 * `routeAfterGate` and `routeAfterCritic` read that state and decide the
 * next node. This separation keeps routing logic out of the nodes and makes
 * the graph topology introspectable, matching the LangGraph recommendation
 * that conditional edges are preferred when only routing (no state updates)
 * is needed.
 *
 * P4: `routeAfterGate` and `routeAfterCritic` short-circuit to `finalize`
 * when `artifact_outcome === 'failed'`. A node can mark the run as failed
 * (e.g. the gate or critic encountering an unrecoverable error) and the
 * conditional edges must skip the remaining loop iterations and route
 * straight to the terminal node so `finalize` can persist the failure
 * state. This avoids burning the remaining repair/critic budget on a
 * run that has already been declared failed.
 *
 * P7: structured `node_enter` / `node_exit` JSON logging is implemented by
 * the `createNodeLifecycleLogger` helper in this file. Each node module
 * wraps its own implementation with `createNodeLifecycleLogger`, so the
 * graph constructor only needs to register the (already-instrumented)
 * node exports. The structured events carry the per-invocation `jobId`,
 * the node name, the event label, an ISO-8601 timestamp, and the
 * orchestration mode.
 *
 * P7 (introspection export): `compileDiagramQuizGraph` returns the
 * compiled LangGraph graph. The compiled object exposes the registered
 * node names and edges through `graph.nodes` and `graph.edges` (when
 * attached), which is what callers and tests use to introspect the
 * topology. The exported `getDiagramQuizCompiledGraph()` memoised getter
 * keeps a single compiled instance per process so introspection and
 * invocation share the same object.
 */
import { END, START, StateGraph } from '@langchain/langgraph';

import type { IArtifactCriticResult } from '@shared-types';

import {
  hasBlockerFailures,
  type ArtifactAgentDefinition,
  type ArtifactAgentJobInput,
  type ArtifactGateFailure,
} from '../artifact-agent/artifact-agent-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../artifact-pipeline-state-keys';
import { criticNode } from './nodes/critic.node';
import { finalizeNode } from './nodes/finalize.node';
import { gateNode } from './nodes/gate.node';
import { generateNode } from './nodes/generate.node';
import { loadContextNode } from './nodes/load-context.node';
import { refinerNode } from './nodes/refiner.node';
import { repairNode } from './nodes/repair.node';
import {
  DIAGRAM_QUIZ_LOOP_COUNTERS,
  DIAGRAM_QUIZ_LOOP_LIMITS,
  DiagramQuizStateAnnotation,
  type DiagramQuizStateShape,
} from './diagram-quiz-state';

/** Node names registered on the `StateGraph`. Kept as constants so edges,
 * conditional edges, and the node factories reference the same identifiers. */
export const DIAGRAM_QUIZ_NODE_NAMES = {
  loadContext: 'load_context',
  generate: 'generate',
  gate: 'gate',
  repair: 'repair',
  refiner: 'refiner',
  critic: 'critic',
  finalize: 'finalize',
} as const;

/** Type alias for the registered node names; useful for callers that want to
 * inspect the compiled graph. */
export type DiagramQuizNodeName =
  (typeof DIAGRAM_QUIZ_NODE_NAMES)[keyof typeof DIAGRAM_QUIZ_NODE_NAMES];

/**
 * Lifecycle event labels emitted by the structured node logger (P7).
 *
 * The labels are deliberately short and machine-readable so they can be
 * grepped or parsed by downstream log tooling without string drift.
 */
export const DIAGRAM_QUIZ_NODE_LIFECYCLE_EVENTS = {
  enter: 'node_enter',
  exit: 'node_exit',
} as const;

/** Orchestration mode reported in every lifecycle log entry. Matches the
 * runner-level `orchestrationMode` so a single grep term surfaces the
 * LangGraph pipeline across nodes, runner, and runner-side errors. */
export const DIAGRAM_QUIZ_ORCHESTRATION_MODE = 'langgraph-runner';

/**
 * Logger sink used by the lifecycle helper. Defaults to the Firebase
 * Functions v2 logger (`logger.debug`) so the events can be turned on/off
 * by log level. Callers can override by importing this constant and
 * reassigning it before any node is wrapped.
 *
 * The type is intentionally narrow: anything with a `debug` method that
 * accepts a `(string, unknown)` payload matches. We avoid pulling in the
 * Firebase Functions types here so unit tests can substitute a stub
 * logger without depending on the cloud SDK.
 */
export type DiagramQuizLifecycleLogger = {
  debug: (message: string, payload: Record<string, unknown>) => void;
};

let lifecycleLogger: DiagramQuizLifecycleLogger | undefined;

/**
 * Resolve the lifecycle logger at call time so test harnesses can swap
 * the sink before any node runs.
 */
function resolveLifecycleLogger(): DiagramQuizLifecycleLogger | undefined {
  if (lifecycleLogger) {
    return lifecycleLogger;
  }
  // Lazy require so the graph module does not have a hard dependency on
  // the Firebase Functions SDK at module-eval time. The SDK is only
  // required when lifecycle events are actually emitted in a non-test
  // environment.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger: firebaseLogger } = require('firebase-functions/v2');
    if (firebaseLogger && typeof firebaseLogger.debug === 'function') {
      lifecycleLogger = firebaseLogger as DiagramQuizLifecycleLogger;
    }
  } catch {
    // firebase-functions/v2 is unavailable (e.g. in a unit test). The
    // helper is a no-op when no sink is registered.
  }
  return lifecycleLogger;
}

/**
 * Test-only override for the lifecycle logger. Production code should
 * not call this — the helper is exposed so unit tests can capture the
 * emitted events without depending on the Firebase Functions SDK.
 */
export function __setDiagramQuizLifecycleLoggerForTests(
  sink: DiagramQuizLifecycleLogger | undefined
): void {
  lifecycleLogger = sink;
}

/**
 * Read the `jobId` off the seeded `job_input` channel. The job input is
 * the canonical place the runner threads the per-invocation id, and it
 * matches `ArtifactAgentJobInput.jobId`. Returning `undefined` (instead
 * of throwing) keeps the lifecycle logger resilient when a node runs
 * outside a fully-seeded pipeline (e.g. in unit tests that pass a stub
 * state).
 */
function readJobId(state: DiagramQuizStateShape): string | undefined {
  const jobInput = state[
    ARTIFACT_PIPELINE_STATE_KEYS.jobInput
  ] as ArtifactAgentJobInput | undefined;
  if (!jobInput) {
    return undefined;
  }
  const jobId = (jobInput as { jobId?: unknown }).jobId;
  return typeof jobId === 'string' && jobId.length > 0 ? jobId : undefined;
}

/**
 * Build the structured lifecycle log payload for a node entry or exit.
 *
 * The shape is intentionally a plain JSON object so the logger sink
 * serialises it as a single structured record. Callers (e.g. log-based
 * tracing, error reporting) can rely on the following keys being
 * present:
 *
 *   - `event`: `'node_enter'` or `'node_exit'`
 *   - `node`: the registered node name
 *   - `jobId`: the per-invocation id (when available)
 *   - `timestamp`: ISO-8601 timestamp captured at the call site
 *   - `orchestrationMode`: `'langgraph-runner'` to disambiguate from the
 *     legacy ADK pipeline
 *   - `durationMs`: only present on `node_exit` events; wall-clock time
 *     between the matching `node_enter` and `node_exit` for the same
 *     `(jobId, node)` pair.
 *
 * The helper does not perform any I/O; it just returns the structured
 * payload so callers can forward it to their preferred sink.
 */
export function buildNodeLifecycleLogPayload(args: {
  node: DiagramQuizNodeName;
  event: (typeof DIAGRAM_QUIZ_NODE_LIFECYCLE_EVENTS)[keyof typeof DIAGRAM_QUIZ_NODE_LIFECYCLE_EVENTS];
  jobId: string | undefined;
  timestamp: string;
  durationMs?: number;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    event: args.event,
    node: args.node,
    jobId: args.jobId,
    timestamp: args.timestamp,
    orchestrationMode: DIAGRAM_QUIZ_ORCHESTRATION_MODE,
  };
  if (typeof args.durationMs === 'number' && Number.isFinite(args.durationMs)) {
    payload.durationMs = args.durationMs;
  }
  return payload;
}

/**
 * Emit a structured lifecycle log entry for a node.
 */
function emitNodeLifecycleLog(payload: Record<string, unknown>): void {
  const sink = resolveLifecycleLogger();
  if (!sink) {
    return;
  }
  sink.debug('diagram-quiz node lifecycle', payload);
}

/**
 * Higher-order factory that wraps a node function with structured
 * `node_enter` / `node_exit` logging (P7).
 *
 * The wrapper preserves the canonical `GraphNode<DiagramQuizStateShape>`
 * contract — the returned function still accepts a single `state`
 * argument and returns a partial state update. The wrapper does NOT
 * catch errors thrown by the inner node; failures are surfaced through
 * the failure channels by the node itself (P4) and the wrapper's
 * `node_exit` event is still emitted before the error propagates so the
 * lifecycle pair is always observable.
 *
 * @param nodeName - The registered node name (matches the key used in
 *   `addNode`). Used as the `node` field in the lifecycle payload.
 * @param node - The original node function. The wrapper delegates to it
 *   unchanged apart from the lifecycle instrumentation.
 * @returns A `GraphNode<DiagramQuizStateShape>`-compatible function that
 *   emits `node_enter` before invocation and `node_exit` after the
 *   returned promise settles (success or failure).
 */
export function createNodeLifecycleLogger<
  TNode extends (state: DiagramQuizStateShape) => unknown
>(nodeName: DiagramQuizNodeName, node: TNode): TNode {
  const wrapped = (async (state: DiagramQuizStateShape) => {
    const jobId = readJobId(state);
    const enterTimestamp = new Date().toISOString();
    emitNodeLifecycleLog(
      buildNodeLifecycleLogPayload({
        node: nodeName,
        event: DIAGRAM_QUIZ_NODE_LIFECYCLE_EVENTS.enter,
        jobId,
        timestamp: enterTimestamp,
      })
    );

    const enterEpochMs = Date.now();
    try {
      const result = await node(state);
      const exitTimestamp = new Date().toISOString();
      emitNodeLifecycleLog(
        buildNodeLifecycleLogPayload({
          node: nodeName,
          event: DIAGRAM_QUIZ_NODE_LIFECYCLE_EVENTS.exit,
          jobId,
          timestamp: exitTimestamp,
          durationMs: Date.now() - enterEpochMs,
        })
      );
      return result;
    } catch (error) {
      const exitTimestamp = new Date().toISOString();
      emitNodeLifecycleLog(
        buildNodeLifecycleLogPayload({
          node: nodeName,
          event: DIAGRAM_QUIZ_NODE_LIFECYCLE_EVENTS.exit,
          jobId,
          timestamp: exitTimestamp,
          durationMs: Date.now() - enterEpochMs,
        })
      );
      throw error;
    }
  }) as unknown as TNode;
  return wrapped;
}

/**
 * Read the iteration counter from the state in a type-safe way. The counters
 * live alongside the locked `session.state` keys but are not part of the
 * durable contract. Using a small accessor avoids sprinkling string literals
 * across conditional edges.
 */
function readRepairIteration(state: DiagramQuizStateShape): number {
  const value = (state as Record<string, unknown>)[
    DIAGRAM_QUIZ_LOOP_COUNTERS.repair
  ];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readCriticIteration(state: DiagramQuizStateShape): number {
  const value = (state as Record<string, unknown>)[
    DIAGRAM_QUIZ_LOOP_COUNTERS.critic
  ];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isArtifactGateFailure(value: unknown): value is ArtifactGateFailure {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('gateId' in value) || !('severity' in value) || !('message' in value)) {
    return false;
  }
  return (
    typeof value.gateId === 'string' &&
    (value.severity === 'warning' || value.severity === 'blocker') &&
    typeof value.message === 'string'
  );
}

/**
 * Read the gate failures array off the state. The contract key for gate
 * failures is part of the locked `ARTIFACT_PIPELINE_STATE_KEYS` map.
 */
function readGateFailures(state: DiagramQuizStateShape): ArtifactGateFailure[] {
  const channel = (state as Record<string, unknown>)[
    ARTIFACT_PIPELINE_STATE_KEYS.gateFailures
  ];
  if (!Array.isArray(channel)) {
    return [];
  }
  return channel.filter(isArtifactGateFailure);
}

/**
 * Read the critic result off the state. Returns `undefined` when the critic
 * has not yet run so the conditional edge can route to `finalize` on first
 * entry.
 */
function readCriticResult(
  state: DiagramQuizStateShape
): IArtifactCriticResult | undefined {
  const value = (state as Record<string, unknown>)[
    ARTIFACT_PIPELINE_STATE_KEYS.criticResult
  ];
  return value as IArtifactCriticResult | undefined;
}

/**
 * Read the artifact definition off the state. Used by the conditional edges
 * to decide whether the verification loop should run at all. The definition
 * is the only place that knows whether `critic` and `refiner` are configured.
 */
function readDefinition(
  state: DiagramQuizStateShape
): ArtifactAgentDefinition<unknown, unknown> | undefined {
  const value = (state as Record<string, unknown>)[
    ARTIFACT_PIPELINE_STATE_KEYS.definition
  ];
  return value as ArtifactAgentDefinition<unknown, unknown> | undefined;
}

/**
 * Read the artifact outcome off the state. Returns `undefined` when no node
 * has yet written an outcome.
 *
 * P4: Used by the conditional edges to short-circuit to `finalize` when a
 * node has already marked the run as failed. The outcome channel is the
 * canonical signal that the run should stop iterating.
 */
function readArtifactOutcome(state: DiagramQuizStateShape): string | undefined {
  const value = (state as Record<string, unknown>)[
    ARTIFACT_PIPELINE_STATE_KEYS.outcome
  ];
  return typeof value === 'string' ? value : undefined;
}

/**
 * P4: Returns true when the artifact outcome has been marked failed by an
 * upstream node. When this is true, both `routeAfterGate` and
 * `routeAfterCritic` must short-circuit to `finalize` so the failure path
 * is persisted without burning additional repair or critic iterations.
 */
function isArtifactOutcomeFailed(state: DiagramQuizStateShape): boolean {
  return readArtifactOutcome(state) === 'failed';
}

/**
 * Decide what node to run after the repair loop has finished. If the
 * definition has both a critic and a refiner, route into the verification
 * loop. Otherwise skip directly to `finalize`.
 */
function resolvePostRepairTarget(state: DiagramQuizStateShape): string {
  const definition = readDefinition(state);
  const hasCriticRefinerLoop =
    !!definition &&
    typeof (definition as { critic?: unknown }).critic === 'object' &&
    typeof (definition as { refiner?: unknown }).refiner === 'object';

  if (hasCriticRefinerLoop) {
    return DIAGRAM_QUIZ_NODE_NAMES.refiner;
  }
  return DIAGRAM_QUIZ_NODE_NAMES.finalize;
}

/**
 * Conditional edge from `gate`. Routes the run either back into the repair
 * loop, forward into the verification loop (or directly into `finalize` when
 * the definition has no critic/refiner), or into `finalize` when the
 * repair iteration budget is exhausted.
 *
 * Exit conditions (mirrors ADK GateAgent `escalate: !hasBlockerFailures(...)`):
 *   1. artifact_outcome === 'failed'                     -> finalize (P4 short-circuit).
 *   2. No blocker failures remain (warnings alone exit the loop).
 *   3. repair_iteration >= maxRepairIterations           -> finalize (budget exhausted).
 *   4. Otherwise                                        -> repair node.
 *
 * Note: we compare `>=` rather than `>` because the gate node itself bumps
 * `repair_iteration` after recording failures, so the budget is reached when
 * the counter equals the limit.
 *
 * P2: This is the `routeAfterGate` conditional edge function. Per the
 * LangGraph JS docs, conditional edges are preferred when routing depends
 * on existing state without additional updates — the gate node writes its
 * result to state, and this function decides the next hop.
 *
 * P4: The failed-outcome short-circuit is evaluated first so a run that
 * has already been declared failed skips both the repair re-entry and the
 * verification loop and routes straight to `finalize`.
 *
 * Return values map to node names registered via `addNode`:
 *   - "repair"   -> re-enter the repair loop.
 *   - "refiner"  -> enter the verification loop.
 *   - "finalize" -> skip to the terminal node (no critic/refiner loop, the
 *                   repair budget was exhausted, or the run was marked
 *                   failed by an upstream node).
 */
export function routeAfterGate(state: DiagramQuizStateShape): string {
  if (isArtifactOutcomeFailed(state)) {
    return DIAGRAM_QUIZ_NODE_NAMES.finalize;
  }

  const failures = readGateFailures(state);
  const repairIterations = readRepairIteration(state);

  if (!hasBlockerFailures(failures)) {
    return resolvePostRepairTarget(state);
  }

  if (repairIterations >= DIAGRAM_QUIZ_LOOP_LIMITS.maxRepairIterations) {
    return resolvePostRepairTarget(state);
  }

  return DIAGRAM_QUIZ_NODE_NAMES.repair;
}

/**
 * Conditional edge from `critic`. Routes either into the refiner (continue
 * the verification loop), or into `finalize` when the loop is done.
 *
 * Exit conditions:
 *   1. artifact_outcome === 'failed'                     -> finalize (P4 short-circuit).
 *   2. Critic verdict is 'pass'                          -> finalize (success).
 *   3. critic_iteration >= maxCriticIterations (2)       -> finalize (budget exhausted).
 *   4. Otherwise                                         -> refiner.
 *
 * The verdict comparison uses string literals that match the
 * `IArtifactCriticOverallVerdict` union from `@shared-types`. The cast is
 * safe because the critic node writes the typed result back to the channel.
 *
 * P2: This is the `routeAfterCritic` conditional edge function. Same
 * rationale as `routeAfterGate`: routing is a pure function of state, so a
 * conditional edge keeps it out of the node body.
 *
 * P4: The failed-outcome short-circuit is evaluated first so a run that
 * has already been declared failed skips the refiner re-entry and routes
 * straight to `finalize`.
 */
export function routeAfterCritic(state: DiagramQuizStateShape): string {
  if (isArtifactOutcomeFailed(state)) {
    return DIAGRAM_QUIZ_NODE_NAMES.finalize;
  }

  const result = readCriticResult(state);
  const criticIterations = readCriticIteration(state);

  if (
    result !== undefined &&
    (result as { overallVerdict?: unknown }).overallVerdict === 'pass'
  ) {
    return DIAGRAM_QUIZ_NODE_NAMES.finalize;
  }

  if (criticIterations >= DIAGRAM_QUIZ_LOOP_LIMITS.maxCriticIterations) {
    return DIAGRAM_QUIZ_NODE_NAMES.finalize;
  }

  return DIAGRAM_QUIZ_NODE_NAMES.refiner;
}

/**
 * Build the diagram-quiz `StateGraph`. The graph is compiled by the caller
 * (see `run-diagram-quiz-pipeline.ts`) so this factory can be reused in tests
 * with different recursion limits or checkpointer configurations.
 *
 * Each node reads `artifact_definition` off the invocation state, so callers
 * must seed the state with the definition before invoking the graph. The
 * `run-diagram-quiz-pipeline.ts` entry point does this in
 * `buildInitialState` so production callers do not need to thread the
 * definition through here.
 *
 * P2: Routing is wired with `addConditionalEdges` (canonical LangGraph
 * pattern). `routeAfterGate` and `routeAfterCritic` are pure functions of
 * state — they read the channels written by the upstream node and return
 * the name of the next node. No `Command.goto` is used inside the gate or
 * critic nodes.
 *
 * P7: every node is already instrumented with the structured
 * `node_enter` / `node_exit` logger (each node module wraps itself with
 * `createNodeLifecycleLogger`). The graph constructor registers the
 * instrumented exports directly so a single lifecycle pair is emitted
 * per node invocation.
 */
export function createDiagramQuizStateGraph() {
  const graph = new StateGraph(DiagramQuizStateAnnotation)
    .addNode(DIAGRAM_QUIZ_NODE_NAMES.loadContext, loadContextNode)
    .addNode(DIAGRAM_QUIZ_NODE_NAMES.generate, generateNode)
    .addNode(DIAGRAM_QUIZ_NODE_NAMES.gate, gateNode)
    .addNode(DIAGRAM_QUIZ_NODE_NAMES.repair, repairNode)
    .addNode(DIAGRAM_QUIZ_NODE_NAMES.refiner, refinerNode)
    .addNode(DIAGRAM_QUIZ_NODE_NAMES.critic, criticNode)
    .addNode(DIAGRAM_QUIZ_NODE_NAMES.finalize, finalizeNode)

    // Linear edges: START -> load_context -> generate -> gate.
    .addEdge(START, DIAGRAM_QUIZ_NODE_NAMES.loadContext)
    .addEdge(
      DIAGRAM_QUIZ_NODE_NAMES.loadContext,
      DIAGRAM_QUIZ_NODE_NAMES.generate
    )
    .addEdge(DIAGRAM_QUIZ_NODE_NAMES.generate, DIAGRAM_QUIZ_NODE_NAMES.gate)

    // Repair loop: gate -> repair -> gate (via `addConditionalEdges` from
    // `gate` using `routeAfterGate`). The path map makes the graph
    // topology introspectable and gives LangGraph a static check that the
    // returned strings correspond to registered nodes.
    .addEdge(DIAGRAM_QUIZ_NODE_NAMES.repair, DIAGRAM_QUIZ_NODE_NAMES.gate)
    .addConditionalEdges(
      DIAGRAM_QUIZ_NODE_NAMES.gate,
      routeAfterGate,
      {
        [DIAGRAM_QUIZ_NODE_NAMES.repair]: DIAGRAM_QUIZ_NODE_NAMES.repair,
        [DIAGRAM_QUIZ_NODE_NAMES.refiner]: DIAGRAM_QUIZ_NODE_NAMES.refiner,
        [DIAGRAM_QUIZ_NODE_NAMES.finalize]: DIAGRAM_QUIZ_NODE_NAMES.finalize,
      }
    )

    // Verification loop: refiner -> critic -> refiner (via
    // `addConditionalEdges` from `critic` using `routeAfterCritic`).
    .addEdge(DIAGRAM_QUIZ_NODE_NAMES.refiner, DIAGRAM_QUIZ_NODE_NAMES.critic)
    .addConditionalEdges(
      DIAGRAM_QUIZ_NODE_NAMES.critic,
      routeAfterCritic,
      {
        [DIAGRAM_QUIZ_NODE_NAMES.refiner]: DIAGRAM_QUIZ_NODE_NAMES.refiner,
        [DIAGRAM_QUIZ_NODE_NAMES.finalize]: DIAGRAM_QUIZ_NODE_NAMES.finalize,
      }
    )

    // Terminal edge: finalize -> END.
    .addEdge(DIAGRAM_QUIZ_NODE_NAMES.finalize, END);

  return graph;
}

/**
 * Memoised compiled-graph getter (P7 introspection export).
 *
 * Each call returns the same compiled `CompiledStateGraph` instance so
 * callers that introspect the topology (`graph.nodes`, `graph.edges`,
 * etc.) share state with the runner that invokes it. The compiled object
 * exposes:
 *
 *   - `nodes`: a record of registered node names to their handlers. Every
 *     handler is wrapped by `createNodeLifecycleLogger` (inside the
 *     individual node modules) so introspection reflects the same
 *     instrumentation the runner sees.
 *   - `edges`: the static edge list (linear + conditional) registered
 *     during graph construction.
 *   - `branches`: the conditional-edge path map for `routeAfterGate` and
 *     `routeAfterCritic`.
 *
 * The compiled graph is the LangGraph equivalent of
 * `InMemoryRunner({ agent, appName: 'study-forge-artifact-agent' })`.
 *
 * Tests that need a fresh compiled graph per case should call
 * `createDiagramQuizStateGraph().compile()` directly.
 */
let _memoisedCompiledGraph: ReturnType<
  ReturnType<typeof createDiagramQuizStateGraph>['compile']
> | undefined;

export function compileDiagramQuizGraph() {
  if (!_memoisedCompiledGraph) {
    _memoisedCompiledGraph = createDiagramQuizStateGraph().compile();
  }
  return _memoisedCompiledGraph;
}

/**
 * Public introspection helper (P7).
 *
 * Returns the memoised compiled graph without forcing a recompile.
 * Tests, debug tools, and health endpoints can call this to inspect the
 * registered nodes and edges of the diagram-quiz LangGraph pipeline.
 *
 * Example:
 *
 *   const graph = getDiagramQuizCompiledGraph();
 *   const nodeNames = Object.keys(graph.nodes ?? {});
 */
export function getDiagramQuizCompiledGraph() {
  return compileDiagramQuizGraph();
}
