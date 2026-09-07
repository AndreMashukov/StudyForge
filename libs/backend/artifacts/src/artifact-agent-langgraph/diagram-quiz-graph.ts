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
 */
import { END, START, StateGraph } from '@langchain/langgraph';

import type { IArtifactCriticResult } from '@shared-types';

import {
  hasBlockerFailures,
  type ArtifactAgentDefinition,
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
  type DiagramQuizState,
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
 * Conditional edge targets after `gate`. Hard-coded as a string literal
 * union so the `addConditionalEdges` mapping is statically verifiable.
 */
export type RouteAfterGateTarget =
  | 'repair'
  | 'refiner'
  | 'finalize';

/**
 * Conditional edge targets after `critic`. Hard-coded as a string literal
 * union so the `addConditionalEdges` mapping is statically verifiable.
 */
export type RouteAfterCriticTarget = 'refiner' | 'finalize';

/**
 * Read the iteration counter from the state in a type-safe way. The counters
 * live alongside the locked `session.state` keys but are not part of the
 * durable contract. Using a small accessor avoids sprinkling string literals
 * across conditional edges.
 */
function readRepairIteration(state: DiagramQuizState): number {
  const value = (state as Record<string, unknown>)[
    DIAGRAM_QUIZ_LOOP_COUNTERS.repair
  ];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readCriticIteration(state: DiagramQuizState): number {
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
function readGateFailures(state: DiagramQuizState): ArtifactGateFailure[] {
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
  state: DiagramQuizState
): IArtifactCriticResult | undefined {
  const value = (state as Record<string, unknown>)[
    ARTIFACT_PIPELINE_STATE_KEYS.criticResult
  ];
  return value as IArtifactCriticResult | undefined;
}

/**
 * Read the artifact outcome off the state. The outcome channel is the
 * canonical signal that a node has marked the run as terminally failed
 * (e.g. an unrecoverable generation failure inside `generate` or `repair`).
 * When the outcome is `failed`, both conditional edges must short-circuit
 * straight to `finalize` so the failure is recorded rather than swallowed
 * by continued loop iterations.
 */
function readArtifactOutcome(state: DiagramQuizState): string | undefined {
  const value = (state as Record<string, unknown>)[
    ARTIFACT_PIPELINE_STATE_KEYS.outcome
  ];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Read the artifact definition off the state. Used by the conditional edges
 * to decide whether the verification loop should run at all. The definition
 * is the only place that knows whether `critic` and `refiner` are configured.
 */
function readDefinition(
  state: DiagramQuizState
): ArtifactAgentDefinition<unknown, unknown> | undefined {
  const value = (state as Record<string, unknown>)[
    ARTIFACT_PIPELINE_STATE_KEYS.definition
  ];
  return value as ArtifactAgentDefinition<unknown, unknown> | undefined;
}

/**
 * Decide what node to run after the repair loop has finished. If the
 * definition has both a critic and a refiner, route into the verification
 * loop. Otherwise skip directly to `finalize`.
 */
function resolvePostRepairTarget(state: DiagramQuizState): string {
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
 * loop, forward into the verification loop, or directly into `finalize`.
 *
 * Bound checks:
 *   - repair loop bound: `repair_iteration_count >= 4` -> leave loop.
 *   - gate failures bound: `hasBlockerFailures(failures)` is false -> leave loop.
 *
 * Exit conditions (mirrors ADK GateAgent `escalate: !hasBlockerFailures(...)`):
 *   1. artifact_outcome === 'failed'                     -> finalize (short-circuit).
 *   2. No blocker failures remain (warnings alone exit the loop).
 *   3. repair_iteration >= maxRepairIterations (4)       -> leave loop (budget exhausted).
 *   4. Otherwise                                        -> repair node.
 *
 * Note: we compare `>=` rather than `>` because the gate node itself bumps
 * `repair_iteration` after recording failures, so the budget is reached when
 * the counter equals the limit.
 *
 * This is the canonical `routeAfterGate` referenced by P1+P2 of the audit
 * spec. It is registered via `addConditionalEdges` so routing logic stays
 * separate from the `gate` node's state updates.
 */
export function routeAfterGate(state: DiagramQuizState): RouteAfterGateTarget {
  // P4: short-circuit to finalize when a node has already marked the run
  // as terminally failed. Without this, a `generate` or `repair` node that
  // writes `artifact_outcome = 'failed'` would still be re-entered via the
  // repair loop, repeatedly burning the recursion budget and re-running the
  // gate/repair cycle on an already-known-bad state.
  if (readArtifactOutcome(state) === 'failed') {
    return DIAGRAM_QUIZ_NODE_NAMES.finalize;
  }

  const failures = readGateFailures(state);
  const repairIterations = readRepairIteration(state);

  if (!hasBlockerFailures(failures)) {
    return resolvePostRepairTarget(state) as RouteAfterGateTarget;
  }

  if (repairIterations >= DIAGRAM_QUIZ_LOOP_LIMITS.maxRepairIterations) {
    return resolvePostRepairTarget(state) as RouteAfterGateTarget;
  }

  return DIAGRAM_QUIZ_NODE_NAMES.repair;
}

/**
 * Conditional edge from `critic`. Routes either into the refiner (continue
 * the verification loop), or into `finalize` when the loop is done.
 *
 * Bound checks:
 *   - critic loop bound: `critic_iteration_count >= 2` -> leave loop.
 *   - critic verdict bound: `overallVerdict === 'pass'` -> leave loop.
 *
 * Exit conditions:
 *   1. artifact_outcome === 'failed'                     -> finalize (short-circuit).
 *   2. Critic verdict is 'pass'                          -> finalize (success).
 *   3. critic_iteration >= maxCriticIterations (2)      -> finalize (budget exhausted).
 *   4. Otherwise                                        -> refiner.
 *
 * The verdict comparison uses string literals that match the
 * `IArtifactCriticOverallVerdict` union from `@shared-types`. The cast is
 * safe because the critic node writes the typed result back to the channel.
 *
 * This is the canonical `routeAfterCritic` referenced by P1+P2 of the audit
 * spec. It is registered via `addConditionalEdges` so routing logic stays
 * separate from the `critic` node's state updates.
 */
export function routeAfterCritic(
  state: DiagramQuizState
): RouteAfterCriticTarget {
  // P4: short-circuit to finalize when a node has already marked the run
  // as terminally failed. A refiner or critic node that detects an
  // unrecoverable condition (e.g. persistent schema failure that cannot be
  // repaired within the loop budget) writes `artifact_outcome = 'failed'`
  // and routing must honor that signal immediately.
  if (readArtifactOutcome(state) === 'failed') {
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
 * Routing topology (P2 of the audit spec):
 *   - `gate` uses `addConditionalEdges` with `routeAfterGate` so the
 *     routing decision is a pure function of state, not a `Command.goto`
 *     inside the node.
 *   - `critic` uses `addConditionalEdges` with `routeAfterCritic` for the
 *     same reason.
 *   - Per-loop bounds (P1): `routeAfterGate` enforces repair_iteration_count
 *     `< 4`; `routeAfterCritic` enforces critic_iteration_count `< 2`. The
 *     shared `recursionLimit` on the runner invocation is a safety net, not
 *     the primary bound.
 *   - P4 short-circuit: both conditional edges check `artifact_outcome` and
 *     route to `finalize` when a node has already marked the run as
 *     terminally failed.
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

    // Repair loop: gate -> repair -> gate (via conditional edge from gate).
    // `routeAfterGate` enforces repair_iteration_count < maxRepairIterations
    // (default 4) and routes to refiner/finalize once the loop exits. It
    // also short-circuits to finalize when artifact_outcome === 'failed'
    // (P4) so a known-failed run does not burn additional loop iterations.
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

    // Verification loop: refiner -> critic -> refiner (via conditional edge
    // from critic). `routeAfterCritic` enforces critic_iteration_count <
    // maxCriticIterations (default 2) and routes to finalize once the loop
    // exits. It also short-circuits to finalize when
    // artifact_outcome === 'failed' (P4).
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
 * Convenience helper that compiles the diagram-quiz graph for direct
 * `invoke()` use. The compiled graph is the LangGraph equivalent of
 * `InMemoryRunner({ agent, appName: 'study-forge-artifact-agent' })`.
 */
export function compileDiagramQuizGraph() {
  return createDiagramQuizStateGraph().compile();
}

/**
 * Pre-compiled, immutable diagram-quiz graph instance exported for
 * introspection (P7 audit fix).
 *
 * This module-level constant is the single source of truth for the compiled
 * diagram-quiz graph. The runner in `run-diagram-quiz-pipeline.ts` and the
 * factory helpers above all hand back the same underlying instance so:
 *
 *   - Introspection: callers (tests, debug endpoints, the orchestrator, or
 *     the audit harness) can read `.nodes`, `.edges`, `.conditionalEdges`,
 *     `.branches`, etc. off the exported `CompiledStateGraph` without having
 *     to re-compile the graph themselves.
 *   - Single compile per process: the graph is compiled exactly once when
 *     this module is first imported, matching how the ADK pipeline
 *     registers its runner singleton. Re-compiling on every run would be
 *     wasteful and would also rebuild the LangGraph closure graph
 *     unnecessarily.
 *   - No `thread_id` coupling: the compiled graph carries no
 *     `configurable.thread_id`; that is bound at `invoke()` time per
 *     `jobId`. The compiled graph instance is therefore safe to share across
 *     concurrent runs.
 *
 * Type note: `compileDiagramQuizGraph()` returns a `CompiledStateGraph`
 * which is fully introspectable - the `.getGraph()` and `.getSubGraph()`
 * helpers from `@langchain/langgraph` work against the same type. Casting
 * to `CompiledStateGraph` (rather than `any`) keeps the export typed so
 * consumers get autocomplete on `nodes`, `edges`, and `branches`.
 */
export const diagramQuizGraph = compileDiagramQuizGraph();
