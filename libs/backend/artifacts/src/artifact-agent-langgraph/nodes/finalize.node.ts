/**
 * LangGraph node: finalize the artifact pipeline run.
 *
 * This node is the terminal node of the diagram-quiz graph. It reads the
 * accumulated pipeline state and produces a final outcome that the runner
 * (`run-diagram-quiz-pipeline.ts`) persists through the normal Firestore
 * teardown.
 *
 * Responsibilities:
 * - Read `artifact_outcome` and `artifact_failure_message` from state. If
 *   a prior node already wrote a failure, the failure channels pass
 *   through unchanged (last-writer-wins on a null/empty default).
 * - If no failure was recorded, mark the run as `succeeded`.
 * - Invoke the artifact definition's `persistCompleted` (on success) or
 *   `markFailed` (on failure) hook so the canonical ADK-side persistence
 *   path (`completePendingDiagramQuiz` / `failPendingDiagramQuiz`) is
 *   called from the LangGraph pipeline, matching the behaviour of the
 *   legacy ADK pipeline that the diagram-quiz definition was authored for.
 * - Push a `finalizer` role entry into `diagnostics.modelUsage` so the
 *   downstream model-usage accounting reflects the finalize step.
 *
 * P6 (single-writer for model channels): this node does NOT write
 * `artifact_generation_model` or `artifact_agent_model`. Those channels
 * are written ONLY by `generate.node.ts`. The finalize pass does not
 * invoke an LLM, so it has no business overwriting the model label. The
 * `artifact_generation_model` / `artifact_agent_model` channels remain
 * whatever `generate.node.ts` last wrote. Any prior version of this node
 * that mirrored these channels has been scrubbed.
 *
 * P3 (wire finalize to definition hooks): this node dispatches to
 * `definition.persistCompleted` or `definition.markFailed` based on
 * `artifact_outcome`, so the LangGraph pipeline uses the same persistence
 * surface as the legacy ADK pipeline.
 *
 * P5: Node signature uses the canonical LangGraph `GraphNode<StateShape>`
 * type so the node accepts the typed `state` argument only and returns a
 * partial state update.
 *
 * P7: this node is wrapped with `createNodeLifecycleLogger` so it emits a
 * structured `node_enter` event before invocation and a `node_exit` event
 * after the partial-state update is returned. Both events carry the
 * per-invocation `jobId`, the node name, an ISO-8601 timestamp, and the
 * orchestration mode. Wrapping the terminal node is especially useful
 * because the `node_exit` event confirms the finalize node completed
 * before the runner observes a terminal outcome.
 */
import type { GraphNode } from '@langchain/langgraph';

import type { IArtifactAgentDiagnostics } from '@shared-types';
import type {
  ArtifactAgentDefinition,
  ArtifactAgentFailure,
  ArtifactAgentResult,
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
 * Result type for the finalize node. Writes `artifact_outcome`,
 * `artifact_failure_message`, and `artifact_diagnostics`.
 *
 * P6 invariant: `artifact_generation_model` and `artifact_agent_model` are
 * NEVER written by this node. Those channels are owned exclusively by
 * `generate.node.ts`. This node must never overwrite them, even if it
 * "knows" the model label.
 */
export type FinalizeNodeResult = Partial<DiagramQuizStateShape>;

/**
 * Build the canonical success-channel update for the finalize node.
 *
 * P6: this helper deliberately does NOT write `artifact_generation_model`
 * or `artifact_agent_model`.
 */
function buildFinalizeSuccess(
  diagnostics: IArtifactAgentDiagnostics
): FinalizeNodeResult {
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.outcome]:
      'succeeded' satisfies ArtifactPipelineOutcome,
    [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: null,
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
  } as FinalizeNodeResult;
}

/**
 * Build the canonical failure-pass-through update for the finalize node.
 *
 * P6: this helper deliberately does NOT write `artifact_generation_model`
 * or `artifact_agent_model`.
 */
function buildFinalizeFailurePassThrough(
  diagnostics: IArtifactAgentDiagnostics,
  failureMessage: string | null
): FinalizeNodeResult {
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.outcome]:
      'failed' satisfies ArtifactPipelineOutcome,
    [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: failureMessage,
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
  } as FinalizeNodeResult;
}

/**
 * Dispatch the persistence hook from the diagram-quiz definition based on
 * the current `artifact_outcome`.
 */
async function dispatchDefinitionPersistenceHook(
  definition: ArtifactAgentDefinition<unknown, unknown>,
  state: DiagramQuizStateShape,
  outcome: ArtifactPipelineOutcome,
  failureMessage: string | null,
  diagnostics: IArtifactAgentDiagnostics
): Promise<void> {
  const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context] as
    | Parameters<typeof definition.persistCompleted>[0]['context']
    | undefined;

  if (outcome === 'succeeded') {
    const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft] as unknown;
    const generationModel =
      (state[ARTIFACT_PIPELINE_STATE_KEYS.generationModel] as
        | string
        | undefined) ?? '';
    const agentModel =
      (state[ARTIFACT_PIPELINE_STATE_KEYS.agentModel] as
        | string
        | undefined) ?? '';

    if (!context) {
      throw new Error(
        'Finalize node requires artifact_context in state to persist success'
      );
    }

    const result: ArtifactAgentResult<unknown> = {
      context: context as ArtifactAgentResult<unknown>['context'],
      draft,
      diagnostics,
      generationModel,
      agentModel,
    };

    await definition.persistCompleted(
      result as Parameters<typeof definition.persistCompleted>[0]
    );
    return;
  }

  // outcome === 'failed'
  const failedContext = context ??
    ({}) as ArtifactAgentFailure['context'];

  const failure: ArtifactAgentFailure = {
    context: failedContext,
    message: failureMessage ?? 'Diagram-quiz pipeline failed without a message',
    diagnostics,
  };

  await definition.markFailed(failure);
}

const finalizeNodeImpl: GraphNode<DiagramQuizStateShape> = async (state) => {
  try {
    const definition = state[
      ARTIFACT_PIPELINE_STATE_KEYS.definition
    ] as ArtifactAgentDefinition<unknown, unknown> | undefined;
    if (!definition) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'Finalize node requires artifact_definition in state',
      } as FinalizeNodeResult;
    }

    const priorOutcome = state[ARTIFACT_PIPELINE_STATE_KEYS.outcome];
    const priorFailureMessage = state[
      ARTIFACT_PIPELINE_STATE_KEYS.failureMessage
    ];

    const diagnostics: IArtifactAgentDiagnostics =
      (state[
        ARTIFACT_PIPELINE_STATE_KEYS.diagnostics
      ] as IArtifactAgentDiagnostics | undefined) ??
      createEmptyDiagnostics(definition);

    recordModelUsage(diagnostics, {
      role: 'finalizer',
      capability: definition.primaryCapability,
    });

    const resolvedOutcome: ArtifactPipelineOutcome =
      priorOutcome === 'failed' ? 'failed' : 'succeeded';
    const resolvedFailureMessage =
      priorOutcome === 'failed'
        ? typeof priorFailureMessage === 'string'
          ? priorFailureMessage
          : null
        : null;

    try {
      await dispatchDefinitionPersistenceHook(
        definition,
        state,
        resolvedOutcome,
        resolvedFailureMessage,
        diagnostics
      );
    } catch (hookError) {
      const reason =
        hookError instanceof Error ? hookError.message : String(hookError);
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          resolvedFailureMessage ??
          `Finalize persistence hook failed: ${reason}`,
        [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
      } as FinalizeNodeResult;
    }

    if (priorOutcome === 'failed') {
      return buildFinalizeFailurePassThrough(
        diagnostics,
        resolvedFailureMessage
      );
    }

    return buildFinalizeSuccess(diagnostics);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
      [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: `Finalize node crashed: ${reason}`,
    } as FinalizeNodeResult;
  }
};

/**
 * P7: wrap the node with the structured `node_enter` / `node_exit` logger
 * so the lifecycle events are emitted from inside the node module too.
 */
export const finalizeNode: GraphNode<DiagramQuizStateShape> =
  createNodeLifecycleLogger(
    DIAGRAM_QUIZ_NODE_NAMES.finalize,
    finalizeNodeImpl
  );

export default finalizeNode;