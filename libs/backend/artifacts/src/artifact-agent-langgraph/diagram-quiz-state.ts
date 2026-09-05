/**
 * LangGraph state schema for the diagram-quiz artifact pipeline.
 *
 * The schema mirrors `ARTIFACT_PIPELINE_STATE_KEYS` so the LangGraph
 * implementation reads and writes the exact same session.state contract as the
 * ADK pipeline. Any divergence between the two implementations will surface at
 * compile time because both modules import the key constants from
 * `../artifact-pipeline-state-keys`.
 *
 * Loop counters (`repair_iteration`, `critic_iteration`) are added to drive the
 * conditional edges for the repair loop and the verification loop respectively.
 *
 * Reducer semantics:
 * - `artifact_diagnostics` uses an append/merge reducer that combines scalar
 *   counters from the latest stage write with appended arrays (`modelUsage`,
 *   `residuals`). This mirrors the ADK behavior where the same diagnostics
 *   object is mutated across stages and written back to session.state.
 * - All other keys use the default LangGraph reducer (last write wins). The
 *   ADK pipeline recomputes gate failures from scratch on every gate stage, so
 *   override behavior is correct there too.
 */
import { Annotation } from '@langchain/langgraph';
import type {
  IArtifactAgentDiagnostics,
  IArtifactCriticResult,
} from '@shared-types';
import type {
  ArtifactAgentContext,
  ArtifactAgentDefinition,
  ArtifactAgentJobInput,
  ArtifactGateFailure,
} from '../artifact-agent/artifact-agent-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../artifact-pipeline-state-keys';

/**
 * The diagram-quiz draft type is intentionally `unknown` here. The actual
 * draft shape (a diagram quiz) is enforced at the definition boundary by the
 * generic `ArtifactAgentDefinition<TDraft, TPayload>`. Nodes cast through the
 * definition, not through the state schema.
 */
type DiagramQuizDraft = unknown;
type DiagramQuizDefinition = ArtifactAgentDefinition<unknown, unknown>;
type DiagramQuizGateFailure = ArtifactGateFailure;
type DiagramQuizCriticResult = IArtifactCriticResult;

/** Terminal outcome the runner reads off the state after `finalize` runs. */
export type ArtifactPipelineOutcome = 'completed' | 'failed';

/**
 * Append/merge reducer for `artifact_diagnostics`. The ADK pipeline treats
 * diagnostics as a single mutable object that stages read, mutate, and write
 * back. In LangGraph, a node return value replaces the previous channel value
 * unless we install a reducer that combines the two.
 *
 * - Scalar counters (`generatorAttempts`, `repairCount`, `criticCycles`) and
 *   other simple fields are taken from the latest write because each stage
 *   mutates those in place and then writes the whole object back. This is
 *   identical to ADK semantics where the diagnostics object is mutated in
 *   place before being persisted to session.state.
 * - Append-style arrays (`modelUsage`, `residuals`) are concatenated so that
 *   audit trail entries from prior stages are not lost when a later stage
 *   writes only its own slice.
 *
 * The reducer is defensive: undefined writes pass through, and missing fields
 * on either side fall back to the other side so a partial update never wipes
 * out data that an earlier stage recorded.
 */
export function mergeDiagnostics(
  current: IArtifactAgentDiagnostics | undefined,
  incoming: IArtifactAgentDiagnostics | undefined
): IArtifactAgentDiagnostics | undefined {
  if (incoming === undefined) {
    return current;
  }
  if (current === undefined) {
    return incoming;
  }
  // Nodes mutate the diagnostics object in place and return the same
  // reference. Without this guard, the reducer would concat each array with
  // itself on every write, doubling the audit trail on each stage.
  const sameReference = current === incoming;
  const modelUsage = sameReference
    ? [...(incoming.modelUsage ?? [])]
    : [...(current.modelUsage ?? []), ...(incoming.modelUsage ?? [])];
  const residuals = sameReference
    ? [...(incoming.residuals ?? [])]
    : [...(current.residuals ?? []), ...(incoming.residuals ?? [])];
  return {
    artifactKind: incoming.artifactKind ?? current.artifactKind,
    agentDefinitionVersion:
      incoming.agentDefinitionVersion ?? current.agentDefinitionVersion,
    adkSessionId: incoming.adkSessionId ?? current.adkSessionId,
    orchestrationMode: incoming.orchestrationMode ?? current.orchestrationMode,
    generatorAttempts:
      typeof incoming.generatorAttempts === 'number'
        ? incoming.generatorAttempts
        : current.generatorAttempts,
    repairCount:
      typeof incoming.repairCount === 'number'
        ? incoming.repairCount
        : current.repairCount,
    criticCycles:
      typeof incoming.criticCycles === 'number'
        ? incoming.criticCycles
        : current.criticCycles,
    modelUsage,
    residuals,
    criticIssues: incoming.criticIssues ?? current.criticIssues,
    artifactDetails: incoming.artifactDetails ?? current.artifactDetails,
  };
}

/**
 * Loop-counter reducer. Conditional edges feed the next iteration index into
 * the channel; nodes may also overwrite the counter with a freshly-computed
 * value. The reducer preserves the incoming value when it is a finite number
 * and falls back to the current value otherwise so an undefined write never
 * silently resets the counter.
 */
export function incrementCounter(
  current: number | undefined,
  incoming: number | undefined
): number {
  if (typeof incoming === 'number' && Number.isFinite(incoming)) {
    return incoming;
  }
  return typeof current === 'number' ? current : 0;
}

/**
 * State schema for the diagram-quiz LangGraph pipeline. Every channel name
 * matches the locked `session.state` key contract exactly, so this state can
 * be substituted for the ADK session state without any rename at the
 * persistence boundary.
 */
export const DiagramQuizStateAnnotation = Annotation.Root({
  [ARTIFACT_PIPELINE_STATE_KEYS.definition]:
    Annotation<DiagramQuizDefinition>(),
  [ARTIFACT_PIPELINE_STATE_KEYS.jobInput]:
    Annotation<ArtifactAgentJobInput>(),
  [ARTIFACT_PIPELINE_STATE_KEYS.context]:
    Annotation<ArtifactAgentContext>(),
  [ARTIFACT_PIPELINE_STATE_KEYS.draft]:
    Annotation<DiagramQuizDraft>(),
  [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: Annotation<
    IArtifactAgentDiagnostics | undefined
  >({
    reducer: (current, incoming) => mergeDiagnostics(current, incoming),
    default: () => undefined,
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]:
    Annotation<DiagramQuizGateFailure[]>(),
  [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: Annotation<
    DiagramQuizCriticResult | undefined
  >(),
  [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: Annotation<
    ArtifactPipelineOutcome | undefined
  >(),
  [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: Annotation<
    string | undefined
  >(),
  [ARTIFACT_PIPELINE_STATE_KEYS.generationModel]: Annotation<
    string | undefined
  >(),
  [ARTIFACT_PIPELINE_STATE_KEYS.agentModel]: Annotation<
    string | undefined
  >(),

  repair_iteration: Annotation<number>({
    reducer: (current, incoming) => incrementCounter(current, incoming),
    default: () => 0,
  }),
  critic_iteration: Annotation<number>({
    reducer: (current, incoming) => incrementCounter(current, incoming),
    default: () => 0,
  }),
});

/** Inferred TypeScript shape of the diagram-quiz graph state. */
export type DiagramQuizState = typeof DiagramQuizStateAnnotation.State;

/**
 * Field names for the diagram-quiz loop counters, in addition to the shared
 * session.state contract. These keys are NOT part of the durable Firestore
 * `session.state` shape; they are internal to the LangGraph state channel and
 * only exist while a run is in flight.
 */
export const DIAGRAM_QUIZ_LOOP_COUNTERS = {
  repair: 'repair_iteration',
  critic: 'critic_iteration',
} as const;

export type DiagramQuizLoopCounterKey =
  (typeof DIAGRAM_QUIZ_LOOP_COUNTERS)[keyof typeof DIAGRAM_QUIZ_LOOP_COUNTERS];

/**
 * Default bounds for diagram-quiz, mirroring the ADK registry entry. These
 * are used by the conditional edges that exit the repair and verification
 * loops when their respective iteration counters exceed the limit.
 */
export const DIAGRAM_QUIZ_LOOP_LIMITS = {
  maxRepairIterations: 4,
  maxCriticIterations: 2,
} as const;

/**
 * Build the initial state for a fresh diagram-quiz pipeline run. The
 * `artifact_definition` and `job_input` channels are seeded from the caller's
 * inputs. Diagnostics start in the same shape the ADK factory uses, and the
 * loop counters start at zero so the conditional edges enter the loop on the
 * first iteration.
 *
 * Returns `Partial<DiagramQuizState>` because the state annotation declares
 * other channels (context, draft, outcome, etc.) as required, but those are
 * populated downstream as the graph runs. Asserting the full state shape
 * here would hide future channel additions from the compiler.
 */
export function createInitialDiagramQuizState(input: {
  definition: DiagramQuizDefinition;
  jobInput: ArtifactAgentJobInput;
  diagnostics: IArtifactAgentDiagnostics;
}): Partial<DiagramQuizState> {
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.definition]: input.definition,
    [ARTIFACT_PIPELINE_STATE_KEYS.jobInput]: input.jobInput,
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: input.diagnostics,
    [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [],
    [DIAGRAM_QUIZ_LOOP_COUNTERS.repair]: 0,
    [DIAGRAM_QUIZ_LOOP_COUNTERS.critic]: 0,
  };
}
