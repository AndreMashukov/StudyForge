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
 *     - gate failures are empty, OR
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

import type { ArtifactAgentDefinition } from '../artifact-agent/artifact-agent-definition';
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

/**
 * Read the gate failures array off the state. The contract key for gate
 * failures is part of the locked `ARTIFACT_PIPELINE_STATE_KEYS` map.
 */
function readGateFailures(state: DiagramQuizState): ReadonlyArray<unknown> {
  const channel = (state as Record<string, unknown>)[
    ARTIFACT_PIPELINE_STATE_KEYS.gateFailures
  ];
  return Array.isArray(channel) ? channel : [];
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
 * Conditional edge from `gate`. Routes the run either back into the repair
 * loop, forward into the verification loop (or directly into `finalize` when
 * the definition has no critic/refiner), or into `finalize` when the
 * repair iteration budget is exhausted.
 *
 * Exit conditions (mirrors the ADK LoopAgent with maxIterations):
 *   1. Gate failures empty AND no residual failures -> leave loop.
 *   2. repair_iteration >= maxRepairIterations       -> leave loop (budget exhausted).
 *   3. Otherwise                                    -> repair node.
 *
 * Note: we compare `>=` rather than `>` because the gate node itself bumps
 * `repair_iteration` after recording failures, so the budget is reached when
 * the counter equals the limit.
 */
function routeFromGate(state: DiagramQuizState): string {
  const failures = readGateFailures(state);
  const repairIterations = readRepairIteration(state);
  const hasFailures = failures.length > 0;

  if (!hasFailures) {
    return resolvePostRepairTarget(state);
  }

  if (repairIterations >= DIAGRAM_QUIZ_LOOP_LIMITS.maxRepairIterations) {
    return resolvePostRepairTarget(state);
  }

  return DIAGRAM_QUIZ_NODE_NAMES.repair;
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
 * Conditional edge from `critic`. Routes either into the refiner (continue
 * the verification loop), or into `finalize` when the loop is done.
 *
 * Exit conditions:
 *   1. Critic verdict is 'pass'                          -> finalize (success).
 *   2. critic_iteration >= maxCriticIterations (2)       -> finalize (budget exhausted).
 *   3. Otherwise                                         -> refiner.
 *
 * The verdict comparison uses string literals that match the
 * `IArtifactCriticOverallVerdict` union from `@shared-types`. The cast is
 * safe because the critic node writes the typed result back to the channel.
 */
function routeFromCritic(state: DiagramQuizState): string {
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
    .addEdge(DIAGRAM_QUIZ_NODE_NAMES.repair, DIAGRAM_QUIZ_NODE_NAMES.gate)
    .addConditionalEdges(
      DIAGRAM_QUIZ_NODE_NAMES.gate,
      routeFromGate,
      {
        [DIAGRAM_QUIZ_NODE_NAMES.repair]: DIAGRAM_QUIZ_NODE_NAMES.repair,
        [DIAGRAM_QUIZ_NODE_NAMES.refiner]: DIAGRAM_QUIZ_NODE_NAMES.refiner,
        [DIAGRAM_QUIZ_NODE_NAMES.finalize]: DIAGRAM_QUIZ_NODE_NAMES.finalize,
      }
    )

    // Verification loop: refiner -> critic -> refiner (via conditional edge
    // from critic). Finalize is also a valid critic exit.
    .addEdge(DIAGRAM_QUIZ_NODE_NAMES.refiner, DIAGRAM_QUIZ_NODE_NAMES.critic)
    .addConditionalEdges(
      DIAGRAM_QUIZ_NODE_NAMES.critic,
      routeFromCritic,
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
