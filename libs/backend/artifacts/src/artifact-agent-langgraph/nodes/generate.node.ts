/**
 * LangGraph node: generate the artifact draft.
 *
 * Mirrors `GenerateAgent` from the ADK `artifact-agent` module:
 *
 * - Reads `artifact_context` (produced by the load-context node) and the
 *   currently-stored `artifact_diagnostics` from state, then delegates to
 *   `definition.generate(context, diagnostics)` to produce a fresh draft.
 * - Increments `diagnostics.generatorAttempts` and ensures a generator
 *   `modelUsage` entry exists. The definition's `recordModelUsage` helper is
 *   the canonical place to push usage entries; we still seed a fallback entry
 *   here so `artifact_generation_model`/`artifact_agent_model` resolve even
 *   if the provider adapter forgot to push one.
 * - Writes `artifact_draft` and the mutated `artifact_diagnostics` back to
 *   state, and records the latest non-empty generator model label as both
 *   `artifact_generation_model` and `artifact_agent_model`. The same
 *   last-write-wins behaviour applies in ADK: both channels are derived from
 *   the same `modelUsage` lookup so they always agree.
 *
 * P6 (single-writer for model channels): `artifact_generation_model` and
 * `artifact_agent_model` are written ONLY by this node. Other nodes
 * (repair, refiner, critic, finalize) must never write to these channels;
 * the generator is the single source of truth because the model label is
 * a property of the generator invocation, not of any downstream
 * repair/refine/critic pass. Any node that previously mirrored these
 * channels has been scrubbed to enforce this invariant.
 *
 * Diagnostics fallback: when `artifact_diagnostics` is absent (e.g. unit tests
 * that bypass the initial state seed), an empty diagnostics object is built
 * from `createEmptyDiagnostics(definition)` so the generator still has a
 * mutable object to push model-usage entries into. This matches the ADK
 * pipeline where the runner seeds an empty diagnostics object during
 * `createInitialSessionState`.
 *
 * Failure semantics (P4): recoverable errors (missing prerequisites or a
 * thrown provider error from `definition.generate`) are caught internally
 * and surfaced through `artifact_outcome = 'failed'` +
 * `artifact_failure_message` instead of being thrown. Throwing would crash
 * the LangGraph runner and bypass the failure-path plumbing in
 * `run-diagram-quiz-pipeline.ts`. By writing the failure channels directly,
 * the graph continues to the `finalize` node (via the existing topology)
 * and the runner can persist the failure outcome through the normal
 * pipeline teardown.
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
 * P8 (no Firestore reads at runtime): this node is permitted to invoke an
 * LLM through `definition.generate` — that is its job. It must NEVER call
 * `getFirestore()`, instantiate a Firestore client, or touch the
 * `session.state` Firestore document. All Firestore-backed inputs must be
 * loaded by `load-context.node.ts` and surfaced through
 * `artifact_context`. If this node needs additional Firestore data, that
 * data must be added to `ArtifactAgentContext` rather than introducing a
 * second Firestore read at runtime.
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
import type {
  ArtifactPipelineOutcome,
  DiagramQuizStateShape,
} from '../diagram-quiz-state';

/**
 * Result type for the generate node. On the success path it writes
 * `artifact_draft`, `artifact_diagnostics`, and (when a generator model
 * label exists) `artifact_generation_model` and `artifact_agent_model`.
 * On the recoverable failure path it writes `artifact_outcome` and
 * `artifact_failure_message`. Declaring the return shape explicitly keeps
 * the graph wiring obvious.
 *
 * P6 invariant: this node is the ONLY writer of `artifact_generation_model`
 * and `artifact_agent_model`. No other node in the diagram-quiz pipeline
 * is permitted to write these channels.
 */
export type GenerateNodeResult = Partial<DiagramQuizStateShape>;

/**
 * Build the canonical failure-channel update for the generate node.
 *
 * Centralising this helper keeps the failure-shape definition in lock-step
 * with the other nodes and ensures every recoverable failure mode produces
 * the same keys (and therefore the same runner-side handling).
 *
 * P6: this helper deliberately does NOT write `artifact_generation_model`
 * or `artifact_agent_model` — those channels are reserved for the success
 * path of this node only, and the failure path leaves them untouched.
 */
function buildGenerateFailure(message: string): GenerateNodeResult {
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.outcome]:
      'failed' satisfies ArtifactPipelineOutcome,
    [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: message,
  } as GenerateNodeResult;
}

/**
 * LangGraph node function: delegates to `definition.generate(context, diagnostics)`.
 *
 * Typed via `GraphNode<DiagramQuizStateShape>` so the state argument and
 * the partial-state return are both constrained by the diagram-quiz state
 * schema. The node reads only from the `state` argument; no Firestore
 * session reference, `session.state` lookup, or other implicit transport
 * is consulted here.
 *
 * @param state - The current diagram-quiz pipeline state. Reads
 *   `artifact_definition`, `artifact_context`, and `artifact_diagnostics`.
 *   All other channels pass through unchanged.
 * @returns A partial state update that writes `artifact_draft`,
 *   `artifact_diagnostics`, and (when discoverable) the generator model
 *   labels on the success path; or `artifact_outcome = 'failed'` +
 *   `artifact_failure_message` on the recoverable failure path.
 */
const generateNodeImpl: GraphNode<DiagramQuizStateShape> = async (state) => {
  try {
    const definition = state[
      ARTIFACT_PIPELINE_STATE_KEYS.definition
    ] as ArtifactAgentDefinition<unknown, unknown> | undefined;
    if (!definition) {
      return buildGenerateFailure(
        'Generate node requires artifact_definition in state'
      );
    }

    const context = state[
      ARTIFACT_PIPELINE_STATE_KEYS.context
    ] as ArtifactAgentContext | undefined;
    if (!context) {
      return buildGenerateFailure(
        'Generate node requires artifact_context (run loadContext first)'
      );
    }

    const diagnostics: IArtifactAgentDiagnostics =
      (state[
        ARTIFACT_PIPELINE_STATE_KEYS.diagnostics
      ] as IArtifactAgentDiagnostics | undefined) ??
      createEmptyDiagnostics(definition);

    let draft: unknown;
    try {
      draft = await definition.generate(context, diagnostics);
    } catch (error) {
      // Recoverable failure: the provider adapter threw (network error,
      // rate limit, schema rejection, etc.). Surface through the canonical
      // failure channels so the runner persists the failure outcome
      // through the normal finalize teardown instead of crashing the
      // LangGraph invocation.
      const reason =
        error instanceof Error ? error.message : String(error);
      return buildGenerateFailure(`Generate failed: ${reason}`);
    }

    diagnostics.generatorAttempts += 1;

    // Record a fallback generator usage entry so `artifact_generation_model`
    // resolves even when the provider adapter did not push one. The duration
    // and capability are filled in by the adapter in real runs; this entry
    // ensures the model-usage lookup performed below always finds at least
    // one row, matching the ADK `GenerateAgent.runAsyncImpl` semantics.
    recordModelUsage(diagnostics, {
      role: 'generator',
      capability: definition.primaryCapability,
    });

    // Prefer the latest generator usage entry that recorded a non-empty model
    // label. This mirrors `GenerateAgent` in the ADK pipeline.
    const generatorModel = [...diagnostics.modelUsage]
      .reverse()
      .find(
        (entry) =>
          entry.role === 'generator' &&
          typeof entry.model === 'string' &&
          entry.model.trim().length > 0
      )?.model;

    const update: GenerateNodeResult = {
      [ARTIFACT_PIPELINE_STATE_KEYS.draft]: draft,
      [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
    };

    // P6: this node is the sole writer of the model-label channels. Both
    // `artifact_generation_model` and `artifact_agent_model` are derived
    // from the same generator modelUsage lookup so they always agree.
    if (generatorModel) {
      update[ARTIFACT_PIPELINE_STATE_KEYS.generationModel] = generatorModel;
      update[ARTIFACT_PIPELINE_STATE_KEYS.agentModel] = generatorModel;
    }

    return update;
  } catch (error) {
    // Last-resort safety net: a synchronous bug in this node (not in user
    // code) is still surfaced through the failure channels rather than
    // re-thrown, so the runner keeps the same shape of outcome regardless
    // of the source of the error.
    const reason =
      error instanceof Error ? error.message : String(error);
    return buildGenerateFailure(`Generate node crashed: ${reason}`);
  }
};

/**
 * P7: wrap the node with the structured `node_enter` / `node_exit` logger
 * so the lifecycle events are emitted from inside the node module too.
 */
export const generateNode: GraphNode<DiagramQuizStateShape> =
  createNodeLifecycleLogger(
    DIAGRAM_QUIZ_NODE_NAMES.generate,
    generateNodeImpl
  );

export default generateNode;