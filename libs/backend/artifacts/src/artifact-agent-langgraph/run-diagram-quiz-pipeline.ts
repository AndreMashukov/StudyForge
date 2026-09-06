/**
 * Entry point for the LangGraph-backed diagram-quiz pipeline.
 *
 * This module is the strangler-fig replacement for the ADK pipeline runner
 * (see `../artifact-agent/artifact-agent-runner.ts`). It exports
 * `runDiagramQuizLangGraphPipeline(input)` which compiles the diagram-quiz
 * `StateGraph`, seeds the initial state from the locked `session.state`
 * contract, invokes the compiled graph, and translates the terminal
 * `artifact_outcome` into the same runner contract the ADK path uses:
 *
 *   - `completed`  -> resolve normally. `definition.persistCompleted` has
 *                     already been called by `finalize`.
 *   - `failed`     -> throw `ArtifactAgentPipelineFailedError` with the
 *                     failure message written by `finalize`.
 *   - missing      -> throw a generic error. This mirrors the ADK runner's
 *                     "finished without a terminal outcome" guard.
 *
 * The cutover is big-bang for diagram-quiz: the Firebase Functions v2
 * endpoint that previously invoked `runArtifactAgentPipeline` for the
 * diagram-quiz artifact kind now invokes this function instead. The
 * endpoint path, request/response shape, and Firestore `session.state`
 * contract are unchanged.
 *
 * Constraint: this file is the only public surface that callers (the
 * Firebase Functions handler and integration tests) need to know about.
 * Everything else under `artifact-agent-langgraph/` is internal to this
 * pipeline implementation.
 */
import { logger } from 'firebase-functions/v2';
import { GraphRecursionError } from '@langchain/langgraph';

import { ArtifactAgentPipelineFailedError } from '../artifact-agent/artifact-agent-errors';
import { ArtifactAgentRegistry } from '../artifact-agent/artifact-agent-registry';
import {
  type ArtifactAgentDefinition,
  type ArtifactAgentJobInput,
} from '../artifact-agent/artifact-agent-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../artifact-pipeline-state-keys';
import { compileDiagramQuizGraph } from './diagram-quiz-graph';
import {
  createInitialDiagramQuizState,
  type DiagramQuizStateUpdate,
} from './diagram-quiz-state';

/**
 * Convenience alias for the LangGraph diagram-quiz definition type. The
 * actual definition is fetched from the shared `ArtifactAgentRegistry`,
 * which is the single source of truth used by both the ADK runner and this
 * LangGraph runner. The registry entry for `diagram-quiz` is the same
 * `ArtifactAgentDefinition<unknown, unknown>` instance the ADK path uses,
 * so node behavior is identical across the two orchestrations.
 */
export type DiagramQuizLangGraphDefinition = ArtifactAgentDefinition<
  unknown,
  unknown
>;

/**
 * Build the seed state for the LangGraph invocation.
 *
 * Mirrors `createInitialSessionState` from the ADK factory, plus the loop
 * counters and `gateFailures` initial value used by the ADK path. Every key
 * is the locked `session.state` key from `ARTIFACT_PIPELINE_STATE_KEYS`;
 * no string literals are introduced here.
 *
 * Keeping this in one helper makes it easy to assert in tests that the
 * LangGraph seed state matches the ADK seed state shape exactly.
 */
function buildInitialState(input: {
  definition: DiagramQuizLangGraphDefinition;
  jobInput: ArtifactAgentJobInput;
}): DiagramQuizStateUpdate {
  return createInitialDiagramQuizState({
    definition: input.definition,
    jobInput: input.jobInput,
    diagnostics: [],
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
 * Mark the diagram-quiz generation record as failed.
 *
 * Centralizes the failure-write path so both the GraphRecursionError catch
 * and the missing-outcome guard emit the same persistent failure signal
 * the ADK runner produces. The function swallows internal write errors so
 * the runner's primary error contract (throw `ArtifactAgentPipelineFailedError`)
 * is preserved.
 */
async function markFailed(
  input: ArtifactAgentJobInput,
  message: string
): Promise<void> {
  try {
    const definition = ArtifactAgentRegistry.get<unknown, unknown>(
      input.artifactKind
    );
    if (definition && typeof definition.persistFailed === 'function') {
      await definition.persistFailed(input, message);
      return;
    }
  } catch (writeError) {
    logger.warn('markFailed: failed to persist failure record', {
      artifactKind: input.artifactKind,
      recordId: input.recordId,
      jobId: input.jobId,
      serializationError:
        writeError instanceof Error ? writeError.message : String(writeError),
      orchestrationMode: 'langgraph-runner',
    });
    return;
  }
  logger.error('Diagram-quiz LangGraph pipeline marked failed', {
    artifactKind: input.artifactKind,
    userId: input.userId,
    recordId: input.recordId,
    jobId: input.jobId,
    message,
    orchestrationMode: 'langgraph-runner',
  });
}

/**
 * Run the LangGraph-backed diagram-quiz pipeline for a single generation
 * job. This is the entry point the Firebase Functions v2 endpoint calls
 * for the diagram-quiz artifact kind after the cutover.
 *
 * Steps:
 *   1. Resolve the diagram-quiz definition from the shared registry.
 *   2. Compile the diagram-quiz `StateGraph` bound to that definition so
 *      each node factory closes over the same instance the ADK path uses.
 *   3. Build the initial state using the locked `session.state` contract.
 *      `artifact_definition`, `job_input`, and the loop counters are
 *      seeded; other channels start at their LangGraph defaults.
 *   4. Stream the compiled graph using `graph.stream` and consume the
 *      async iterator to completion. `recursionLimit` is set to 25 as a
 *      safety net above the topology's worst-case super-step count
 *      (load-context + generate + gate/repair loop up to 8 +
 *      refiner/critic loop up to 4 + finalize = 15). The session id is
 *      passed via `configurable.thread_id` so the graph's checkpointer
 *      (if attached) keys state by session.
 *   5. Read the terminal outcome from the final chunk and translate it
 *      into the same contract `runArtifactAgentPipeline` exposes:
 *      resolve on `completed`, throw `ArtifactAgentPipelineFailedError`
 *      on `failed`, throw a generic error when the outcome is missing.
 *
 * Error handling:
 *   - `GraphRecursionError` from LangGraph (recursion budget exhausted
 *     before finalize wrote a terminal outcome) is caught explicitly,
 *     routed through `markFailed`, and rethrown as
 *     `ArtifactAgentPipelineFailedError` so the Firebase Functions
 *     handler logs a single failure transition.
 *   - Other thrown errors propagate. This matches the ADK runner's
 *     propagation behavior.
 *   - The runner does not retry. Retry semantics are the caller's
 *     responsibility (see `ArtifactAgentPipelineFailedError`).
 *
 * Logging:
 *   - The runner logs the start, completion, and failure transitions with
 *     `orchestrationMode: 'langgraph-runner'` so logs are distinguishable
 *     from the ADK path during the cutover.
 */
export async function runDiagramQuizLangGraphPipeline(
  input: ArtifactAgentJobInput
): Promise<void> {
  if (input.artifactKind !== 'diagramQuiz') {
    throw new Error(
      `runDiagramQuizLangGraphPipeline received unexpected artifactKind: ${String(
        input.artifactKind
      )}`
    );
  }

  const definition =
    ArtifactAgentRegistry.get<unknown, unknown>('diagramQuiz');

  logger.info('Starting diagram-quiz LangGraph pipeline', {
    artifactKind: input.artifactKind,
    userId: input.userId,
    recordId: input.recordId,
    jobId: input.jobId,
    orchestrationMode: 'langgraph-runner',
  });

  const graph = compileDiagramQuizGraph();
  const initialState = buildInitialState({ definition, jobInput: input });

  // Use `graph.stream` (not `graph.invoke`) so the runner consumes the
  // LangGraph event stream to completion. `graph.invoke` would block on
  // the entire pipeline before any progress signal could be observed;
  // streaming lets each chunk represent one super-step and gives callers
  // a hook for mid-pipeline progress writes if needed.
  //
  // The async iterator MUST be drained to completion. If we abandon the
  // stream mid-iteration, downstream nodes never run and the finalize
  // step is skipped. The for-await-of loop guarantees full consumption
  // and surfaces any in-stream exceptions through the try/catch below.
  //
  // `recursionLimit` is set to 25 as a safety net (not the primary bound).
  // Per-loop bounds are enforced by the explicit iteration counters in
  // the state schema and the conditional routing functions. The recursion
  // limit just guarantees the graph cannot run away indefinitely.
  //
  // `configurable.thread_id` is set to the session id so any checkpointer
  // attached to the compiled graph keys per-session state by this id.
  const config = {
    recursionLimit: 25,
    configurable: {
      thread_id: input.sessionId,
    },
  };

  let finalState: Record<string, unknown> | undefined;

  try {
    const stream = await graph.stream(initialState, config);

    for await (const chunk of stream) {
      // Each chunk is a partial state update emitted after a super-step.
      // We retain the most recent chunk as the candidate final state. If
      // the finalize node ran, its chunk will be the last one and will
      // carry the terminal `artifact_outcome`.
      if (chunk && typeof chunk === 'object') {
        finalState = chunk as Record<string, unknown>;
      }
    }
  } catch (error) {
    // Recursion budget exhausted before the finalize node wrote a
    // terminal outcome. This is the canonical LangGraph failure mode when
    // explicit loop counters and conditional routing fail to bound a
    // graph. Route to the failure path so the caller observes the same
    // contract as an in-graph `failed` outcome.
    if (error instanceof GraphRecursionError) {
      const message =
        'Diagram-quiz LangGraph pipeline exceeded recursion limit before reaching a terminal outcome';
      logger.error('Diagram-quiz LangGraph pipeline recursion limit exceeded', {
        artifactKind: input.artifactKind,
        userId: input.userId,
        recordId: input.recordId,
        jobId: input.jobId,
        recursionLimit: config.recursionLimit,
        threadId: config.configurable.thread_id,
        orchestrationMode: 'langgraph-runner',
      });
      await markFailed(input, message);
      throw new ArtifactAgentPipelineFailedError(message);
    }
    throw error;
  }

  if (!finalState) {
    const message =
      'Diagram-quiz LangGraph pipeline produced no state chunks (stream drained empty)';
    logger.error(message, {
      artifactKind: input.artifactKind,
      userId: input.userId,
      recordId: input.recordId,
      jobId: input.jobId,
      orchestrationMode: 'langgraph-runner',
    });
    await markFailed(input, message);
    throw new ArtifactAgentPipelineFailedError(message);
  }

  const outcome = readFinalOutcome(finalState);

  if (outcome === 'failed') {
    const message = readFinalFailureMessage(finalState);
    logger.warn('Diagram-quiz LangGraph pipeline failed verification', {
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
      `Diagram-quiz LangGraph pipeline finished without a terminal outcome (jobId=${input.jobId})`
    );
  }

  logger.info('Diagram-quiz LangGraph pipeline completed', {
    artifactKind: input.artifactKind,
    userId: input.userId,
    recordId: input.recordId,
    jobId: input.jobId,
    orchestrationMode: 'langgraph-runner',
  });
}
