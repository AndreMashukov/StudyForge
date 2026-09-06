/**
 * LangGraph gate node for the diagram-quiz pipeline.
 *
 * Mirrors the ADK `GateAgent`:
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
 *
 * Failure semantics (P4): recoverable errors (missing prerequisites or a
 * thrown error from `runArtifactGates`) are caught internally and surfaced
 * through `artifact_outcome = 'failed'` + `artifact_failure_message`
 * instead of being thrown. Throwing would crash the LangGraph runner and
 * bypass the failure-path plumbing in `run-diagram-quiz-pipeline.ts`. By
 * writing the failure channels directly, the graph continues to the
 * `finalize` node (via the existing topology) and the runner can persist
 * the failure outcome through the normal pipeline teardown.
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
 * P7: this node is wrapped with `createNodeLifecycleLogger` so it emits a
 * structured `node_enter` event before invocation and a `node_exit` event
 * after the partial-state update is returned. Both events carry the
 * per-invocation `jobId`, the node name, an ISO-8601 timestamp, and the
 * orchestration mode.
 *
 * P8 (deterministic validators, no LLM, no Firestore): this node is the
 * canonical "rule gate" for the diagram-quiz pipeline. It runs ONLY the
 * deterministic validator set declared on `definition.gates` — pure,
 * synchronous-or-async, side-effect-free predicate functions that read
 * the draft and `artifact_context` and return `ArtifactGateFailure`
 * records. It MUST NOT:
 *
 * - Invoke any LLM (no `@langchain/core` model calls, no `ChatPromptTemplate`,
 *   no provider adapter that hits a remote generation API).
 * - Read from or write to Firestore (no `getFirestore()`, no session/state
 *   document access — `load-context.node.ts` is the sole Firestore fetcher
 *   in this pipeline).
 * - Call into any other network or external system.
 *
 * `runArtifactGates(definition.gates, draft, context)` is the only
 * authoritative gate runner in the codebase (see
 * `libs/backend/artifacts/src/artifact-agent/artifact-agent-definition.ts`),
 * and it enforces the deterministic-only contract at the definition level.
 * If a gate descriptor needed an LLM, that decision belongs in
 * `definition.critic` or a future dedicated node, never here. Routing
 * after this node is decided by `routeAfterGate` (in
 * `diagram-quiz-graph.ts`) off the contents of `artifact_gate_failures`
 * and the `repair_iteration_count` cap — this node writes state and
 * returns, the graph decides where to go next.
 *
 * P6 (single-writer for model channels): this node does NOT write
 * `artifact_generation_model` or `artifact_agent_model`. Those channels
 * are written ONLY by `generate.node.ts`. Gate validation never touches
 * model labels.
 */
import type { GraphNode } from '@langchain/langgraph';

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
import {
  createNodeLifecycleLogger,
  DIAGRAM_QUIZ_NODE_NAMES,
} from '../diagram-quiz-graph';
import type {
  ArtifactPipelineOutcome,
  DiagramQuizStateShape,
} from '../diagram-quiz-state';

const DIAGNOSTICS_KEY = ARTIFACT_PIPELINE_STATE_KEYS.diagnostics satisfies ArtifactPipelineStateKey;
const CONTEXT_KEY = ARTIFACT_PIPELINE_STATE_KEYS.context satisfies ArtifactPipelineStateKey;
const DRAFT_KEY = ARTIFACT_PIPELINE_STATE_KEYS.draft satisfies ArtifactPipelineStateKey;
const DEFINITION_KEY = ARTIFACT_PIPELINE_STATE_KEYS.definition satisfies ArtifactPipelineStateKey;

/**
 * Build the canonical failure-channel update for the gate node.
 *
 * Centralising this helper keeps the failure-shape definition in lock-step
 * with the other nodes and ensures every recoverable failure mode produces
 * the same keys (and therefore the same runner-side handling).
 *
 * P8: this helper is pure — it writes only to the canonical failure
 * channels and `repair_iteration_count`. It performs no I/O.
 *
 * P6: it does NOT touch `artifact_generation_model` or
 * `artifact_agent_model`.
 */
function buildGateFailure(message: string): Partial<DiagramQuizStateShape> {
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [] as ArtifactGateFailure[],
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: {
      artifactKind: 'diagramQuiz',
      agentDefinitionVersion: 0,
      orchestrationMode: 'langgraph-runner',
      generatorAttempts: 0,
      repairCount: 0,
      criticCycles: 0,
      modelUsage: [],
      residuals: [],
    } as unknown as IArtifactAgentDiagnostics,
    [ARTIFACT_PIPELINE_STATE_KEYS.outcome]:
      'failed' satisfies ArtifactPipelineOutcome,
    [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: message,
    repair_iteration_count: 0,
  };
}

/**
 * LangGraph node that runs the deterministic artifact gates against the
 * current draft and records the failures.
 *
 * Typed via `GraphNode<DiagramQuizStateShape>` so the state argument and
 * the partial-state return are both constrained by the diagram-quiz state
 * schema. The node reads only from the `state` argument; no Firestore
 * session reference, `session.state` lookup, or other implicit transport
 * is consulted here.
 *
 * P8 contract:
 *  - Deterministic: inputs are `artifact_draft` + `artifact_context`; the
 *    validator set is fixed by `definition.gates`. A given (draft,
 *    context, gates) triple always produces the same
 *    `artifact_gate_failures` and `mergeFailuresIntoDiagnostics` result.
 *  - No LLM: only pure validator functions are invoked. The node never
 *    instantiates a chat model, prompt template, or provider adapter.
 *  - No Firestore: the node never calls `getFirestore()`, reads from a
 *    Firestore document, or writes to one. All context required for
 *    validation was already loaded by `load-context.node.ts`.
 *  - Routing is handled by `routeAfterGate` (in
 *    `diagram-quiz-graph.ts`), not by `Command.goto` inside this node
 *    (see P2 in the audit spec).
 */
const gateNodeImpl: GraphNode<DiagramQuizStateShape> = async (state) => {
  try {
    const definition = state[DEFINITION_KEY];
    if (!definition) {
      return buildGateFailure(
        'Artifact definition must be present before gate evaluation'
      );
    }

    const agentContext = state[CONTEXT_KEY] as Parameters<typeof runArtifactGates>[2];
    if (agentContext === undefined || agentContext === null) {
      return buildGateFailure(
        'Artifact context must be loaded before gate evaluation'
      );
    }

    const draft = state[DRAFT_KEY];
    if (draft === undefined) {
      return buildGateFailure(
        'Artifact draft must be generated before gate evaluation'
      );
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

    let gateResult: ReturnType<typeof runArtifactGates> extends Promise<infer R>
      ? R
      : never;
    try {
      // P8: `runArtifactGates` is the canonical deterministic-validator
      // runner. It accepts only the validator set declared on
      // `definition.gates` and runs each predicate against `(draft,
      // context)`. It makes no LLM calls and no Firestore calls; any
      // error it throws is a contract violation that we surface through
      // the canonical failure channels.
      gateResult = await runArtifactGates(definition.gates, draft, agentContext);
    } catch (error) {
      // Recoverable failure: the deterministic gate evaluator threw (e.g.
      // a malformed gate descriptor or an unexpected runtime exception).
      // Surface through the canonical failure channels so the runner
      // persists the failure outcome through the normal finalize teardown
      // instead of crashing the LangGraph invocation.
      const reason =
        error instanceof Error ? error.message : String(error);
      return buildGateFailure(`Gate evaluation failed: ${reason}`);
    }

    mergeFailuresIntoDiagnostics(diagnostics, gateResult.failures);

    const previousIteration =
      typeof state.repair_iteration_count === 'number'
        ? state.repair_iteration_count
        : 0;
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
      repair_iteration_count: nextIteration,
      // P6: do NOT write `artifact_generation_model` or
      // `artifact_agent_model` here — see node-level docstring.
      // P2: do NOT use `Command.goto` to route; `routeAfterGate` reads
      // this return value and decides the next node.
    };
  } catch (error) {
    // Last-resort safety net: a synchronous bug in this node (not in user
    // code) is still surfaced through the failure channels rather than
    // re-thrown, so the runner keeps the same shape of outcome regardless
    // of the source of the error.
    const reason =
      error instanceof Error ? error.message : String(error);
    return buildGateFailure(`Gate node crashed: ${reason}`);
  }
};

/**
 * P7: wrap the node with the structured `node_enter` / `node_exit` logger
 * so the lifecycle events are emitted from inside the node module too.
 */
export const gateNode: GraphNode<DiagramQuizStateShape> =
  createNodeLifecycleLogger(
    DIAGRAM_QUIZ_NODE_NAMES.gate,
    gateNodeImpl
  );

export default gateNode;