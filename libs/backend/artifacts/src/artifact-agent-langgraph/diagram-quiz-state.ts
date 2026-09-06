/**
 * LangGraph state schema for the diagram-quiz artifact pipeline.
 *
 * The schema mirrors `ARTIFACT_PIPELINE_STATE_KEYS` so the LangGraph
 * implementation reads and writes the exact same session.state contract as the
 * ADK pipeline. Any divergence between the two implementations will surface at
 * compile time because both modules import the key constants from
 * `../artifact-pipeline-state-keys`.
 *
 * Loop counters (`repair_iteration_count`, `critic_iteration_count`) are
 * added to drive the conditional edges for the repair loop and the
 * verification loop respectively.
 *
 * CamelCase drift check (t2):
 * Every channel name below is sourced from `ARTIFACT_PIPELINE_STATE_KEYS`,
 * not typed as a literal. The local property names on that constant are
 * camelCase (e.g. `jobInput`, `gateFailures`), but the resolved string
 * values are snake_case (e.g. `job_input`, `artifact_gate_failures`). The
 * mapping is verified by the audit fix in this file: every channel below
 * uses the camelCase property (`ARTIFACT_PIPELINE_STATE_KEYS.jobInput`)
 * which resolves to the canonical snake_case string (`job_input`).
 *
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.definition`     -> `artifact_definition`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.jobInput`      -> `job_input`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.context`       -> `artifact_context`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.draft`         -> `artifact_draft`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.diagnostics`   -> `artifact_diagnostics`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.gateFailures`  -> `artifact_gate_failures`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.criticResult`  -> `artifact_critic_result`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.outcome`       -> `artifact_outcome`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.failureMessage`-> `artifact_failure_message`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.generationModel`->`artifact_generation_model`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.agentModel`    -> `artifact_agent_model`
 *
 * Reducer semantics (P0 audit fix):
 * - `artifact_diagnostics` and `artifact_gate_failures` use a last-write-wins
 *   reducer (`(prev, next) => next ?? prev`). Nodes in the diagram-quiz
 *   pipeline recompute the full diagnostics object and the full gate-failure
 *   list from scratch on each stage write, mirroring ADK semantics where the
 *   diagnostics object is mutated in place and then persisted back to
 *   session.state. Using a concat reducer here would double-count entries
 *   because nodes return the full current list, not deltas.
 * - Loop counters preserve an incoming finite number and fall back to the
 *   current value otherwise, so an undefined write never silently resets the
 *   counter.
 * - All other keys use the default LangGraph reducer (last write wins).
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
 * Last-write-wins reducer for channels whose nodes return the full current
 * value (not a delta). The incoming value is preferred when defined; an
 * undefined write passes through so a partial update never wipes out data
 * that an earlier stage recorded.
 */
export function replaceWithNext<T>(
  current: T | undefined,
  incoming: T | undefined
): T | undefined {
  if (incoming === undefined) {
    return current;
  }
  return incoming;
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
 *
 * Uses `Annotation.Root` only. We intentionally do not introduce a parallel
 * `StateSchema` + `ReducedValue` + zod schema, because that would create a
 * dual schema with two sources of truth for the same channels. Reducers live
 * on the `Annotation` channels themselves.
 *
 * Every channel key is sourced from `ARTIFACT_PIPELINE_STATE_KEYS` to keep
 * the camelCase (local property) -> snake_case (canonical string) mapping
 * enforced at compile time. Hand-typed literals would defeat the audit
 * check; do not introduce any here.
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
    reducer: (current, incoming) => replaceWithNext(current, incoming),
    default: () => undefined,
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: Annotation<
    DiagramQuizGateFailure[] | undefined
  >({
    reducer: (current, incoming) => replaceWithNext(current, incoming),
    default: () => [],
  }),
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

  repair_iteration_count: Annotation<number>({
    reducer: (current, incoming) => incrementCounter(current, incoming),
    default: () => 0,
  }),
  critic_iteration_count: Annotation<number>({
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
  repair: 'repair_iteration_count',
  critic: 'critic_iteration_count',
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