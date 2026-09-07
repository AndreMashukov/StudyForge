/**
 * LangGraph state schema for the flashcards artifact pipeline.
 *
 * The schema mirrors `ARTIFACT_PIPELINE_STATE_KEYS` so the LangGraph
 * implementation reads and writes the exact same session.state contract as
 * the ADK pipeline. Any divergence between the two implementations will
 * surface at compile time because both modules import the key constants
 * from `../artifact-pipeline-state-keys`.
 *
 * Flashcards is repair-only: there is no critic node, no refiner node, and
 * no critic_iteration channel. The only loop counter is
 * `repair_iteration_count`, which the `gate` conditional edge uses to
 * decide whether to re-enter the `repair` node or advance to `finalize`.
 *
 * CamelCase drift check:
 * Every channel name below is sourced from `ARTIFACT_PIPELINE_STATE_KEYS`,
 * not typed as a literal. The local property names on that constant are
 * camelCase (e.g. `jobInput`, `gateFailures`), but the resolved string
 * values are snake_case (e.g. `job_input`, `artifact_gate_failures`).
 *
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.definition`     -> `artifact_definition`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.jobInput`      -> `job_input`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.context`       -> `artifact_context`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.draft`         -> `artifact_draft`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.diagnostics`   -> `artifact_diagnostics`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.gateFailures`  -> `artifact_gate_failures`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.outcome`       -> `artifact_outcome`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.failureMessage`-> `artifact_failure_message`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.generationModel`->`artifact_generation_model`
 *  - `ARTIFACT_PIPELINE_STATE_KEYS.agentModel`    -> `artifact_agent_model`
 *
 * Reducer semantics:
 * - `artifact_diagnostics` and `artifact_gate_failures` use a last-write-wins
 *   reducer (`(prev, next) => next ?? prev`). Nodes in the flashcards
 *   pipeline recompute the full diagnostics object and the full gate-failure
 *   list from scratch on each stage write, mirroring ADK semantics where the
 *   diagnostics object is mutated in place and then persisted back to
 *   session.state. Using a concat reducer here would double-count entries
 *   because nodes return the full current list, not deltas.
 * - Loop counters preserve an incoming finite number and fall back to the
 *   current value otherwise, so an undefined write never silently resets the
 *   counter.
 * - All other keys use the default LangGraph reducer (last write wins).
 *
 * Phase A note: shared symbols previously located under `../artifact-agent/`
 * have been relocated. `ArtifactAgentContext` and `ArtifactAgentDefinition`
 * are imported from `../artifact-definition`. `ArtifactAgentJobInput` is
 * imported from `../artifact-job-input`.
 */
import { Annotation } from '@langchain/langgraph';
import type { IArtifactAgentDiagnostics } from '@shared-types';
import type {
  ArtifactAgentContext,
  ArtifactAgentDefinition,
  ArtifactGateFailure,
} from '../../artifact-definition';
import type { ArtifactAgentJobInput } from '../../artifact-job-input';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';

/**
 * The flashcards draft type is intentionally `unknown` here. The actual
 * draft shape (a flashcards payload) is enforced at the definition boundary
 * by the generic `ArtifactAgentDefinition<TDraft, TPayload>`. Nodes cast
 * through the definition, not through the state schema.
 */
type FlashcardsDraft = unknown;
type FlashcardsDefinition = ArtifactAgentDefinition<unknown, unknown>;
type FlashcardsGateFailure = ArtifactGateFailure;

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
 * Loop-counter reducer. Nodes write the next counter value themselves.
 * This reducer does not add 1. It keeps a finite incoming number and
 * otherwise keeps the current value so an undefined write does not reset
 * the counter.
 */
export function keepFiniteNumber(
  current: number | undefined,
  incoming: number | undefined
): number {
  if (typeof incoming === 'number' && Number.isFinite(incoming)) {
    return incoming;
  }
  return typeof current === 'number' ? current : 0;
}

/**
 * State schema for the flashcards LangGraph pipeline. Every channel name
 * matches the locked `session.state` key contract exactly, so this state
 * can be substituted for the ADK session state without any rename at the
 * persistence boundary.
 *
 * Uses `Annotation.Root` only. We intentionally do not introduce a parallel
 * `StateSchema` + `ReducedValue` + zod schema, because that would create a
 * dual schema with two sources of truth for the same channels. Reducers
 * live on the `Annotation` channels themselves.
 *
 * Every channel key is sourced from `ARTIFACT_PIPELINE_STATE_KEYS` to keep
 * the camelCase (local property) -> snake_case (canonical string) mapping
 * enforced at compile time. Hand-typed literals would defeat the audit
 * check; do not introduce any here.
 *
 * Flashcards does NOT declare a `criticResult` channel. The diagram-quiz
 * schema includes one because the verification loop writes there; the
 * flashcards graph has no verification loop, so the channel would be
 * permanently undefined and is intentionally omitted to keep the schema
 * minimal.
 */
export const FlashcardsStateAnnotation = Annotation.Root({
  [ARTIFACT_PIPELINE_STATE_KEYS.definition]:
    Annotation<FlashcardsDefinition>(),
  [ARTIFACT_PIPELINE_STATE_KEYS.jobInput]:
    Annotation<ArtifactAgentJobInput>(),
  [ARTIFACT_PIPELINE_STATE_KEYS.context]:
    Annotation<ArtifactAgentContext>(),
  [ARTIFACT_PIPELINE_STATE_KEYS.draft]:
    Annotation<FlashcardsDraft>(),
  [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: Annotation<
    IArtifactAgentDiagnostics | undefined
  >({
    reducer: (current, incoming) => replaceWithNext(current, incoming),
    default: () => undefined,
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: Annotation<
    FlashcardsGateFailure[] | undefined
  >({
    reducer: (current, incoming) => replaceWithNext(current, incoming),
    default: () => [],
  }),
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
    reducer: (current, incoming) => keepFiniteNumber(current, incoming),
    default: () => 0,
  }),
});

/** Inferred TypeScript shape of the flashcards graph state. */
export type FlashcardsState = typeof FlashcardsStateAnnotation.State;

/**
 * Runtime alias for the Annotation value. Exists so node modules that
 * import `FlashcardsState` (as a value) can use it with `typeof X.State`
 * access patterns. The state schema itself is named
 * `FlashcardsStateAnnotation`.
 */
export const FlashcardsStateValue = FlashcardsStateAnnotation;

/**
 * Field name for the flashcards repair loop counter, in addition to the
 * shared session.state contract. This key is NOT part of the durable
 * Firestore `session.state` shape; it is internal to the LangGraph state
 * channel and only exists while a run is in flight.
 *
 * Flashcards is repair-only and has no critic/refiner loop, so this is
 * the only loop counter the schema declares.
 */
export const FLASHCARDS_LOOP_COUNTERS = {
  repair: 'repair_iteration_count',
} as const;

export type FlashcardsLoopCounterKey =
  (typeof FLASHCARDS_LOOP_COUNTERS)[keyof typeof FLASHCARDS_LOOP_COUNTERS];

/**
 * Default bounds for flashcards, mirroring the ADK registry entry. This is
 * the canonical home of the post-ADK `maxRepairIterations` value (per the
 * Phase D relocation in the migration spec). The diagram-quiz graph keeps
 * its own limit constant in `diagram-quiz-state.ts`; flashcards does the
 * same here rather than importing the deleted ADK registry.
 *
 * Used by the conditional edge that exits the repair loop when the
 * iteration counter exceeds the limit.
 */
export const FLASHCARDS_LOOP_LIMITS = {
  maxRepairIterations: 2,
} as const;

/**
 * Build the initial state for a fresh flashcards pipeline run. The
 * `artifact_definition` and `job_input` channels are seeded from the
 * caller's inputs. Diagnostics start in the same shape the ADK factory
 * uses, and the repair loop counter starts at zero so the conditional edge
 * enters the loop on the first iteration. Gate failures start as an empty
 * list (the default reducer for the channel, but spelled out here so the
 * initial-state contract is explicit).
 *
 * Returns `Partial<FlashcardsState>` because the state annotation declares
 * other channels (context, draft, outcome, etc.) as required, but those are
 * populated downstream as the graph runs. Asserting the full state shape
 * here would hide future channel additions from the compiler.
 *
 * Without this seed the runner cannot satisfy `routeAfterGate`'s
 * `< maxRepairIterations` comparison (per P5 of the spec): the conditional
 * edge would see `repair_iteration_count === undefined` and treat the loop
 * as already exhausted. Seeding the counter to `0` here is what makes the
 * first iteration enter the repair loop when gate failures remain.
 */
export function createInitialFlashcardsState(input: {
  definition: FlashcardsDefinition;
  jobInput: ArtifactAgentJobInput;
  diagnostics: IArtifactAgentDiagnostics;
}): Partial<FlashcardsState> {
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.definition]: input.definition,
    [ARTIFACT_PIPELINE_STATE_KEYS.jobInput]: input.jobInput,
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: input.diagnostics,
    [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [],
    [FLASHCARDS_LOOP_COUNTERS.repair]: 0,
  };
}