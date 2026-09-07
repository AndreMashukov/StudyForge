/**
 * LangGraph `StateGraph` wiring for the flashcards artifact pipeline.
 *
 * This file is the structural counterpart to the ADK `SequentialAgent` graph
 * described in the migration spec. It encodes the same topology, but with
 * flashcards being repair-only (no critic, no refiner):
 *
 *   START -> load_context -> generate -> gate
 *
 * Repair loop:
 *   gate -> repair -> gate   (conditional edge from `gate` selects next node)
 *   Exit condition:
 *     - no blocker gate failures remain (warnings alone do not keep looping), OR
 *     - repair_iteration exceeds maxRepairIterations (2)
 *
 * Terminal:
 *   gate | repair | loop_exit -> finalize -> END
 *
 * The graph is intentionally generic over the definition type. The actual
 * `ArtifactAgentDefinition<TDraft, TPayload>` is stored on the state via
 * `artifact_definition` and is read out by each node. This keeps the node
 * functions free of pipeline structure concerns.
 *
 * Phase A note: shared symbols previously located under `../artifact-agent/`
 * have been relocated. `ArtifactAgentDefinition` and `ArtifactGateFailure`
 * are now imported from `../artifact-definition`.
 *
 * Phase D note: `maxRepairIterations` for flashcards lives in
 * `flashcards-state.ts` (`FLASHCARDS_LOOP_LIMITS.maxRepairIterations = 2`).
 * The ADK registry (`../artifact-agent/artifact-agent-registry.ts`) is
 * deleted in Phase D, so this graph never imports the deleted module.
 */
import { END, START, StateGraph } from '@langchain/langgraph';

import type {
  ArtifactAgentDefinition,
  ArtifactGateFailure,
} from '../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../artifact-pipeline-state-keys';
import { finalizeNode } from '../nodes/finalize.node';
import { gateNode } from '../nodes/gate.node';
import { generateNode } from '../nodes/generate.node';
import { loadContextNode } from '../nodes/load-context.node';
import { repairNode } from '../nodes/repair.node';
import {
  FLASHCARDS_LOOP_COUNTERS,
  FLASHCARDS_LOOP_LIMITS,
  FlashcardsStateAnnotation,
  type FlashcardsState,
} from './flashcards-state';

/** Node names registered on the `StateGraph`. Kept as constants so edges,
 * conditional edges, and the node factories reference the same identifiers. */
export const FLASHCARDS_NODE_NAMES = {
  loadContext: 'load_context',
  generate: 'generate',
  gate: 'gate',
  repair: 'repair',
  finalize: 'finalize',
} as const;

/** Type alias for the registered node names; useful for callers that want
 * to inspect the compiled graph. */
export type FlashcardsNodeName =
  (typeof FLASHCARDS_NODE_NAMES)[keyof typeof FLASHCARDS_NODE_NAMES];

/**
 * Conditional edge targets after `gate`. Hard-coded as a string literal
 * union so the `addConditionalEdges` mapping is statically verifiable.
 *
 * Flashcards is repair-only, so the post-repair target is always
 * `finalize`; there is no refiner branch in this graph.
 */
export type RouteAfterGateTarget = 'repair' | 'finalize';

/**
 * Read the iteration counter from the state in a type-safe way. The counter
 * lives alongside the locked `session.state` keys but is not part of the
 * durable contract. Using a small accessor avoids sprinkling string literals
 * across conditional edges.
 */
function readRepairIteration(state: FlashcardsState): number {
  const value = (state as Record<string, unknown>)[
    FLASHCARDS_LOOP_COUNTERS.repair
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
function readGateFailures(state: FlashcardsState): ArtifactGateFailure[] {
  const channel = (state as Record<string, unknown>)[
    ARTIFACT_PIPELINE_STATE_KEYS.gateFailures
  ];
  if (!Array.isArray(channel)) {
    return [];
  }
  return channel.filter(isArtifactGateFailure);
}

/**
 * Read the artifact outcome off the state. The outcome channel is the
 * canonical signal that a node has marked the run as terminally failed
 * (e.g. an unrecoverable generation failure inside `generate` or `repair`).
 * When the outcome is `failed`, the conditional edge must short-circuit
 * straight to `finalize` so the failure is recorded rather than swallowed
 * by continued loop iterations.
 */
function readArtifactOutcome(state: FlashcardsState): string | undefined {
  const value = (state as Record<string, unknown>)[
    ARTIFACT_PIPELINE_STATE_KEYS.outcome
  ];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Local helper that mirrors the `hasBlockerFailures` predicate used by
 * diagram-quiz. Flashcards does not depend on that helper being exported
 * from `../artifact-definition`; defining it here keeps the flashcards
 * graph self-contained and decoupled from diagram-quiz wiring.
 */
function hasBlockerFailures(failures: ArtifactGateFailure[]): boolean {
  return failures.some((failure) => failure.severity === 'blocker');
}

/**
 * Conditional edge from `gate`. Routes the run either back into the repair
 * loop or directly into `finalize`.
 *
 * Bound checks:
 *   - repair loop bound: `repair_iteration_count >= 2` -> leave loop.
 *   - gate failures bound: `hasBlockerFailures(failures)` is false -> leave loop.
 *
 * Exit conditions (mirrors ADK GateAgent `escalate: !hasBlockerFailures(...)`):
 *   1. artifact_outcome === 'failed'                     -> finalize (short-circuit).
 *   2. No blocker failures remain (warnings alone exit the loop).
 *   3. repair_iteration >= maxRepairIterations (2)       -> leave loop (budget exhausted).
 *   4. Otherwise                                        -> repair node.
 *
 * Note: we compare `>=` rather than `>` because the gate node itself bumps
 * `repair_iteration` after recording failures, so the budget is reached when
 * the counter equals the limit.
 *
 * This is the canonical `routeAfterGate` for the flashcards graph. It is
 * registered via `addConditionalEdges` so routing logic stays separate from
 * the `gate` node's state updates.
 *
 * Phase P4 short-circuit: when a node has already written
 * `artifact_outcome = 'failed'` (e.g. `generate` could not produce a draft,
 * or `repair` exhausted its retries against an unfixable schema failure),
 * this edge routes straight to `finalize`. Without that branch, a failed
 * `generate` would still enter the repair loop on missing draft, repeatedly
 * burning the recursion budget and re-running the gate/repair cycle on an
 * already-known-bad state.
 */
export function routeAfterGate(state: FlashcardsState): RouteAfterGateTarget {
  // P4: short-circuit to finalize when a node has already marked the run
  // as terminally failed. Without this, a `generate` or `repair` node that
  // writes `artifact_outcome = 'failed'` would still be re-entered via the
  // repair loop, repeatedly burning the recursion budget and re-running the
  // gate/repair cycle on an already-known-bad state.
  if (readArtifactOutcome(state) === 'failed') {
    return FLASHCARDS_NODE_NAMES.finalize;
  }

  const failures = readGateFailures(state);
  const repairIterations = readRepairIteration(state);

  if (!hasBlockerFailures(failures)) {
    return FLASHCARDS_NODE_NAMES.finalize;
  }

  if (repairIterations >= FLASHCARDS_LOOP_LIMITS.maxRepairIterations) {
    return FLASHCARDS_NODE_NAMES.finalize;
  }

  return FLASHCARDS_NODE_NAMES.repair;
}

/**
 * Build the flashcards `StateGraph`. The graph is compiled by the caller
 * (see `run-flashcards-pipeline.ts`) so this factory can be reused in tests
 * with different recursion limits or checkpointer configurations.
 *
 * Each node reads `artifact_definition` off the invocation state, so
 * callers must seed the state with the definition before invoking the
 * graph. The `run-flashcards-pipeline.ts` entry point does this via
 * `createInitialFlashcardsState` so production callers do not need to
 * thread the definition through here.
 *
 * Routing topology:
 *   - `gate` uses `addConditionalEdges` with `routeAfterGate` so the
 *     routing decision is a pure function of state, not a `Command.goto`
 *     inside the node.
 *   - Per-loop bound: `routeAfterGate` enforces repair_iteration_count
 *     `< 2`. The shared `recursionLimit` on the runner invocation is a
 *     safety net, not the primary bound.
 *   - P4 short-circuit: `routeAfterGate` checks `artifact_outcome` and
 *     routes to `finalize` when a node has already marked the run as
 *     terminally failed.
 *   - Flashcards is repair-only: there is no critic, no refiner, and no
 *     verification loop. The diagram-quiz nodes (`critic.node.ts`,
 *     `refiner.node.ts`) are intentionally not imported here.
 */
export function createFlashcardsStateGraph() {
  const graph = new StateGraph(FlashcardsStateAnnotation)
    .addNode(FLASHCARDS_NODE_NAMES.loadContext, loadContextNode)
    .addNode(FLASHCARDS_NODE_NAMES.generate, generateNode)
    .addNode(FLASHCARDS_NODE_NAMES.gate, gateNode)
    .addNode(FLASHCARDS_NODE_NAMES.repair, repairNode)
    .addNode(FLASHCARDS_NODE_NAMES.finalize, finalizeNode)

    // Linear edges: START -> load_context -> generate -> gate.
    .addEdge(START, FLASHCARDS_NODE_NAMES.loadContext)
    .addEdge(
      FLASHCARDS_NODE_NAMES.loadContext,
      FLASHCARDS_NODE_NAMES.generate
    )
    .addEdge(FLASHCARDS_NODE_NAMES.generate, FLASHCARDS_NODE_NAMES.gate)

    // Repair loop: gate -> repair -> gate (via conditional edge from gate).
    // `routeAfterGate` enforces repair_iteration_count < maxRepairIterations
    // (2 for flashcards) and routes to finalize once the loop exits. It
    // also short-circuits to finalize when artifact_outcome === 'failed'
    // (P4) so a known-failed run does not burn additional loop iterations.
    .addEdge(FLASHCARDS_NODE_NAMES.repair, FLASHCARDS_NODE_NAMES.gate)
    .addConditionalEdges(
      FLASHCARDS_NODE_NAMES.gate,
      routeAfterGate,
      {
        [FLASHCARDS_NODE_NAMES.repair]: FLASHCARDS_NODE_NAMES.repair,
        [FLASHCARDS_NODE_NAMES.finalize]: FLASHCARDS_NODE_NAMES.finalize,
      }
    )

    // Terminal edge: finalize -> END.
    .addEdge(FLASHCARDS_NODE_NAMES.finalize, END);

  return graph;
}

/**
 * Convenience helper that compiles the flashcards graph for direct
 * `invoke()` use. The compiled graph is the LangGraph equivalent of
 * `InMemoryRunner({ agent, appName: 'study-forge-artifact-agent' })`.
 */
export function compileFlashcardsGraph() {
  return createFlashcardsStateGraph().compile();
}

/**
 * Pre-compiled, immutable flashcards graph instance exported for
 * introspection.
 *
 * This module-level constant is the single source of truth for the compiled
 * flashcards graph. The runner in `run-flashcards-pipeline.ts` and the
 * factory helpers above all hand back the same underlying instance so:
 *
 *   - Introspection: callers (tests, debug endpoints, the orchestrator, or
 *     the audit harness) can read `.nodes`, `.edges`, `.conditionalEdges`,
 *     `.branches`, etc. off the exported `CompiledStateGraph` without
 *     having to re-compile the graph themselves.
 *   - Single compile per process: the graph is compiled exactly once when
 *     this module is first imported, matching how the ADK pipeline
 *     registers its runner singleton. Re-compiling on every run would be
 *     wasteful and would also rebuild the LangGraph closure graph
 *     unnecessarily.
 *   - No `thread_id` coupling: the compiled graph carries no
 *     `configurable.thread_id`; that is bound at `invoke()` time per
 *     `jobId`. The compiled graph instance is therefore safe to share
 *     across concurrent runs.
 *
 * Type note: `compileFlashcardsGraph()` returns a `CompiledStateGraph`
 * which is fully introspectable - the `.getGraph()` and `.getSubGraph()`
 * helpers from `@langchain/langgraph` work against the same type. Casting
 * to `CompiledStateGraph` (rather than `any`) keeps the export typed so
 * consumers get autocomplete on `nodes`, `edges`, and `branches`.
 */
export const flashcardsGraph = compileFlashcardsGraph();