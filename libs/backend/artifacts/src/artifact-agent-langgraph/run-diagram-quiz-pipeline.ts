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

import { ArtifactAgentPipelineFailedError } from '../artifact-agent/artifact-agent-errors';
import {
  createEmptyDiagnostics,
  type ArtifactAgentDefinition,
  type ArtifactAgentJobInput,
} from '../artifact-agent/artifact-agent-definition';
import { compileDiagramQuizGraph } from './diagram-quiz-graph';
import {
  ARTIFACT_PIPELINE_STATE_KEYS as _UNUSED_STATE_KEYS,
} from '../artifact-pipeline-state-keys';
import { createInitialDiagramQuizState } from './diagram-quiz-state';

// `ARTIFACT_PIPELINE_STATE_KEYS` is re-exported by the barrel `index.ts` and
// referenced by callers that want to read the outcome/failure message keys
// out of the final state. Importing it here keeps the dependency graph
// explicit and surfaces any drift between the ADK and LangGraph
// implementations at compile time.
void _UNUSED_STATE_KEYS;

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
}) {
  const diagnostics = createEmptyDiagnostics(input.definition);
  return createInitialDiagramQuizState({
    definition: input.definition,
    jobInput: input.jobInput,
    diagnostics,
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
  const outcome = finalState[ARTIFACT_PIPELINE_STATE_KEYS_OUTCOME];
  if (outcome === 'completed' || outcome === 'failed') {
    return outcome;
  }
  return undefined;
}

// Local re-export of the outcome key, aliased to keep the public surface of
// this module narrow. Callers that need the keys directly import them from
// the barrel `index.ts`.
const ARTIFACT_PIPELINE_STATE_KEYS_OUTCOME = 'artifact_outcome';
const ARTIFACT_PIPELINE_STATE_KEYS_FAILURE_MESSAGE = 'artifact_failure_message';

/**
 * Read the failure message off the final state. Mirrors
 * `readPipelineFailureMessage` from the ADK factory: returns the stored
 * message when it is a non-empty string, otherwise the generic fallback.
 * The fallback is intentionally identical to the ADK fallback so error
 * messages logged by the runner match across orchestrations.
 */
function readFinalFailureMessage(finalState: Record<string, unknown>): string {
  const message = finalState[ARTIFACT_PIPELINE_STATE_KEYS_FAILURE_MESSAGE];
  return typeof message === 'string' && message.trim().length > 0
    ? message
    : 'Automated verification failed';
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
 *   4. Invoke the compiled graph. `invoke()` runs the graph to
 *      completion and returns the final state.
 *   5. Read the terminal outcome and translate it into the same contract
 *      `runArtifactAgentPipeline` exposes: resolve on `completed`, throw
 *      `ArtifactAgentPipelineFailedError` on `failed`, throw a generic
 *      error when the outcome is missing.
 *
 * Error handling:
 *   - The graph throws if a node throws. This is the same propagation
 *     behavior the ADK runner relies on - the Firebase Functions handler
 *     logs the error and marks the generation record failed.
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

  // `invoke()` runs the compiled graph to completion. The LangGraph
  // equivalent of consuming the ADK `runAsync` event stream to completion.
  // The `recursionLimit` is the only knob callers typically need; it
  // bounds the worst-case number of node executions for a single run. The
  // default of 25 is sufficient for the diagram-quiz topology (7 nodes
  // + repair loop up to 4 iterations + critic loop up to 2 iterations),
  // and we pass it explicitly to make the budget auditable.
  const finalState = (await graph.invoke(initialState, {
    recursionLimit: 50,
  })) as Record<string, unknown>;

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

// Late import to avoid a circular dependency at module load time. The
// registry re-exports the diagram-quiz definition from
// `../diagram-quiz/diagram-quiz-definition` and the LangGraph graph reads
// the same definition out of state. Importing the registry here, scoped
// to this file, keeps the entry point self-contained while letting the
// graph module remain testable in isolation.
import { ArtifactAgentRegistry } from '../artifact-agent/artifact-agent-registry';