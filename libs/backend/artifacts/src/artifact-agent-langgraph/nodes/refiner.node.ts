/**
 * LangGraph node: refine the artifact draft before the critic review.
 *
 * Mirrors the refiner step from the ADK `artifact-agent` module:
 *
 * - Reads `artifact_draft` and `artifact_context` from state.
 * - Delegates to `definition.refine(context, draft, diagnostics)` to
 *   produce a polished draft for the critic pass.
 * - Pushes a `refiner` role entry into `diagnostics.modelUsage` so the
 *   downstream model-usage accounting reflects the refinement invocation.
 * - Writes `artifact_draft` and the mutated `artifact_diagnostics` back to
 *   state, then returns. The critic node runs on the next super-step.
 *
 * P6 (single-writer for model channels): this node does NOT write
 * `artifact_generation_model` or `artifact_agent_model`. Those channels
 * are written ONLY by `generate.node.ts`. The refiner pass may invoke an
 * LLM, but the model label is a property of the original generator
 * invocation — it does not change just because a refinement pass touched
 * the draft. The refiner role is recorded in `diagnostics.modelUsage` for
 * accounting, but the `artifact_generation_model` /
 * `artifact_agent_model` channels remain whatever `generate.node.ts` last
 * wrote.
 *
 * P5: Node signature uses the canonical LangGraph `GraphNode<StateShape>`
 * type so the node accepts the typed `state` argument only and returns a
 * partial state update.
 *
 * P7: this node is wrapped with `createNodeLifecycleLogger` so it emits a
 * structured `node_enter` event before invocation and a `node_exit` event
 * after the partial-state update is returned. Both events carry the
 * per-invocation `jobId`, the node name, an ISO-8601 timestamp, and the
 * orchestration mode.
 *
 * P8 (no Firestore reads at runtime): this node is permitted to invoke an
 * LLM through `definition.refine` — that is its job. It must NEVER call
 * `getFirestore()`, instantiate a Firestore client, or touch the
 * `session.state` Firestore document. All Firestore-backed inputs must be
 * loaded by `load-context.node.ts` and surfaced through
 * `artifact_context`. Refinement is purely a (state-in / partial-state-out)
 * transform.
 */
import type { GraphNode } from '@langchain/langgraph';

import type { IArtifactAgentDiagnostics } from '@shared-types';
import type {
  ArtifactAgentContext,
  ArtifactAgentDefinition,
} from '../../artifact-agent/artifact-agent-definition';
import {
  createEmptyDiagnostics,
  recordModelUsage,
} from '../../artifact-agent/artifact-agent-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import {
  createNodeLifecycleLogger,
  DIAGRAM_QUIZ_NODE_NAMES,
} from '../diagram-quiz-graph';
import type { DiagramQuizStateShape } from '../diagram-quiz-state';

/**
 * Result type for the refiner node. On the success path it writes
 * `artifact_draft` and `artifact_diagnostics`. On the recoverable failure
 * path it writes `artifact_outcome` and `artifact_failure_message`.
 *
 * P6 invariant: `artifact_generation_model` and `artifact_agent_model` are
 * NEVER written by this node. Those channels are owned exclusively by
 * `generate.node.ts`.
 *
 * P8 invariant: this node does not perform any Firestore reads or writes.
 */
export type RefinerNodeResult = Partial<DiagramQuizStateShape>;

/**
 * Build the canonical failure-channel update for the refiner node.
 *
 * Centralising this helper keeps the failure-shape definition in lock-step
 * with the other nodes and ensures every recoverable failure mode produces
 * the same keys (and therefore the same runner-side handling).
 *
 * P6: this helper deliberately does NOT touch `artifact_generation_model`
 * or `artifact_agent_model`.
 *
 * P8: this helper does not perform any Firestore reads or writes.
 */
function buildRefinerFailure(message: string): RefinerNodeResult {
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
    [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: message,
  } as RefinerNodeResult;
}

/**
 * LangGraph node function: delegates to
 * `definition.refine(context, draft, diagnostics)`.
 *
 * Typed via `GraphNode<DiagramQuizStateShape>` so the state argument and
 * the partial-state return are both constrained by the diagram-quiz state
 * schema. The node reads only from the `state` argument; no Firestore
 * session reference, `session.state` lookup, or other implicit transport
 * is consulted here.
 *
 * @param state - The current diagram-quiz pipeline state. Reads
 *   `artifact_definition`, `artifact_context`, and `artifact_draft`.
 * @returns A partial state update that writes `artifact_draft` and
 *   `artifact_diagnostics` on the success path; or
 *   `artifact_outcome = 'failed'` + `artifact_failure_message` on the
 *   recoverable failure path.
 */
const refinerNodeImpl: GraphNode<DiagramQuizStateShape> = async (state) => {
  try {
    const definition = state[
      ARTIFACT_PIPELINE_STATE_KEYS.definition
    ] as ArtifactAgentDefinition<unknown, unknown> | undefined;
    if (!definition) {
      return buildRefinerFailure(
        'Refiner node requires artifact_definition in state'
      );
    }

    const context = state[
      ARTIFACT_PIPELINE_STATE_KEYS.context
    ] as ArtifactAgentContext | undefined;
    if (!context) {
      return buildRefinerFailure(
        'Refiner node requires artifact_context (run loadContext first)'
      );
    }

    const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
    if (typeof draft !== 'string' || draft.length === 0) {
      return buildRefinerFailure(
        'Refiner node requires a non-empty artifact_draft in state'
      );
    }

    const diagnostics: IArtifactAgentDiagnostics =
      (state[
        ARTIFACT_PIPELINE_STATE_KEYS.diagnostics
      ] as IArtifactAgentDiagnostics | undefined) ??
      createEmptyDiagnostics(definition);

    let nextDraft: unknown;
    try {
      // P8: `definition.refine` may invoke an LLM; that is its role.
      // However, this node MUST NOT itself read from Firestore — all
      // context was already loaded by `load-context.node.ts` and surfaced
      // via `artifact_context`.
      nextDraft = await definition.refine(context, draft, diagnostics);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : String(error);
      return buildRefinerFailure(`Refine failed: ${reason}`);
    }

    // Record the refiner role in modelUsage so the downstream accounting
    // reflects the refinement invocation. The model label is intentionally
    // left empty here — the refiner may not be a discrete model from the
    // generator, and the canonical `artifact_generation_model` /
    // `artifact_agent_model` channels are owned by `generate.node.ts`.
    recordModelUsage(diagnostics, {
      role: 'refiner',
      capability: definition.primaryCapability,
    });

    return {
      [ARTIFACT_PIPELINE_STATE_KEYS.draft]: nextDraft,
      [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
      // P6: do NOT write `artifact_generation_model` or
      // `artifact_agent_model` here — see node-level docstring.
      // P8: do NOT read from or write to Firestore here.
    } as RefinerNodeResult;
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : String(error);
    return buildRefinerFailure(`Refiner node crashed: ${reason}`);
  }
};

/**
 * P7: wrap the node with the structured `node_enter` / `node_exit` logger
 * so the lifecycle events are emitted from inside the node module too.
 */
export const refinerNode: GraphNode<DiagramQuizStateShape> =
  createNodeLifecycleLogger(
    DIAGRAM_QUIZ_NODE_NAMES.refiner,
    refinerNodeImpl
  );

export default refinerNode;