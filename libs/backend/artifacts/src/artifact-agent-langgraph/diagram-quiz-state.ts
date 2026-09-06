/**
 * LangGraph state schema for the diagram-quiz artifact pipeline.
 *
 * The schema mirrors `ARTIFACT_PIPELINE_STATE_KEYS` so the LangGraph
 * implementation reads and writes the exact same session.state contract as the
 * ADK pipeline. Any divergence between the two implementations will surface at
 * compile time because both modules import the key constants from
 * `../artifact-pipeline-state-keys`.
 *
 * Loop counters (`repair_iteration_count`, `critic_iteration_count`) are added
 * to drive the conditional edges for the repair loop and the verification loop
 * respectively. They are internal to the LangGraph state channel and are NOT
 * part of the durable Firestore `session.state` shape.
 *
 * Reducer semantics (LangGraph JS 1.0 `StateSchema` + `ReducedValue`):
 * - `artifact_diagnostics` and `artifact_gate_failures` use an additive
 *   reducer that concatenates arrays so that entries from earlier repair and
 *   gate iterations are preserved across the loop. Without a reducer,
 *   LangGraph defaults to last-writer-wins and would discard diagnostics from
 *   earlier iterations.
 * - All other session.state keys (`artifact_draft`, `artifact_context`,
 *   `artifact_critic_result`, `artifact_outcome`, `artifact_failure_message`,
 *   `artifact_generation_model`, `artifact_agent_model`) use the default
 *   last-writer-wins reducer, which is correct because each node is the sole
 *   owner of those channels within its stage.
 * - Iteration counters use last-writer-wins so nodes can overwrite the counter
 *   with the freshly incremented value on each pass through the loop. They
 *   carry an explicit default of 0 so the conditional edges enter the loop on
 *   the first iteration.
 */
import { Annotation, ReducedValue, StateSchema } from '@langchain/langgraph';
import * as z from 'zod';

import { ARTIFACT_PIPELINE_STATE_KEYS } from '../artifact-pipeline-state-keys';

/**
 * Canonical state schema for the diagram-quiz graph.
 *
 * Channel names are sourced from `ARTIFACT_PIPELINE_STATE_KEYS` so the locked
 * `session.state` key contract is enforced at compile time. Any drift between
 * the keys declared here and the keys declared in
 * `artifact-pipeline-state-keys.ts` will fail TypeScript checks because the
 * channel names are read off the constants object.
 *
 * The schema intentionally avoids projecting the underlying draft shape onto
 * the state. The diagram-quiz draft type is enforced at the definition
 * boundary by the generic `ArtifactAgentDefinition<TDraft, TPayload>`. Nodes
 * cast through the definition, not through the state schema.
 */
export const DiagramQuizState = new StateSchema({
  [ARTIFACT_PIPELINE_STATE_KEYS.definition]: z.record(z.unknown()),
  [ARTIFACT_PIPELINE_STATE_KEYS.jobInput]: z.record(z.unknown()),
  [ARTIFACT_PIPELINE_STATE_KEYS.context]: z.record(z.unknown()),
  [ARTIFACT_PIPELINE_STATE_KEYS.draft]: z.string(),
  [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: new ReducedValue(
    z.array(z.record(z.unknown())).default(() => []),
    { reducer: (prev, next) => prev.concat(next) }
  ),
  [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: new ReducedValue(
    z.array(z.record(z.unknown())).default(() => []),
    { reducer: (prev, next) => prev.concat(next) }
  ),
  [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: z
    .record(z.unknown())
    .nullable(),
  [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: z.string(),
  [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: z.string().nullable(),
  [ARTIFACT_PIPELINE_STATE_KEYS.generationModel]: z.string(),
  [ARTIFACT_PIPELINE_STATE_KEYS.agentModel]: z.string(),

  repair_iteration_count: z.number().default(() => 0),
  critic_iteration_count: z.number().default(() => 0),
});

/**
 * Annotation root used to seed the `StateGraph`. Mirrors `DiagramQuizState`
 * but is exported under the `*Annotation` name so node modules that import
 * the annotation root (rather than the `StateSchema` constructor) continue
 * to compile. The annotation root has the same channel shape as the
 * `StateSchema` so type inference matches across imports.
 */
export const DiagramQuizStateAnnotation = Annotation.Root({
  [ARTIFACT_PIPELINE_STATE_KEYS.definition]: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => next ?? prev,
    default: () => ({}),
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.jobInput]: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => next ?? prev,
    default: () => ({}),
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.context]: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => next ?? prev,
    default: () => ({}),
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.draft]: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: Annotation<Array<Record<string, unknown>>>({
    reducer: (prev, next) => prev.concat(next ?? []),
    default: () => [],
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: Annotation<Array<Record<string, unknown>>>({
    reducer: (prev, next) => prev.concat(next ?? []),
    default: () => [],
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: Annotation<Record<string, unknown> | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.generationModel]: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  [ARTIFACT_PIPELINE_STATE_KEYS.agentModel]: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  repair_iteration_count: Annotation<number>({
    reducer: (prev, next) => (typeof next === 'number' ? next : prev),
    default: () => 0,
  }),
  critic_iteration_count: Annotation<number>({
    reducer: (prev, next) => (typeof next === 'number' ? next : prev),
    default: () => 0,
  }),
});

/** Inferred TypeScript shape of the diagram-quiz graph state. */
export type DiagramQuizStateShape = typeof DiagramQuizState.State;

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
 * Convenience alias for the LangGraph state shape used by node functions
 * and the runner. This keeps `Readonly<Partial<...>>`-style updates from
 * each node flowing through a single type alias rather than re-deriving
 * the shape at every call site.
 */
export type DiagramQuizStateUpdate = Partial<DiagramQuizStateShape>;

/**
 * Build the initial state for the diagram-quiz graph. The returned object
 * matches the locked `session.state` contract so the LangGraph runner can
 * seed the compiled graph without introducing string literals.
 *
 * @param params.definition - The diagram-quiz `ArtifactAgentDefinition`. Stored
 *   on the `artifact_definition` channel so every node can recover it.
 * @param params.jobInput - The runner-threaded job input. Stored on the
 *   `job_input` channel.
 * @param params.diagnostics - The empty diagnostics array seeded by the ADK
 *   factory. Stored on the `artifact_diagnostics` channel so the additive
 *   reducer starts from a known empty array.
 */
export function createInitialDiagramQuizState(params: {
  definition: unknown;
  jobInput: unknown;
  diagnostics: unknown[];
}): DiagramQuizStateUpdate {
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.definition]: params.definition as Record<
      string,
      unknown
    >,
    [ARTIFACT_PIPELINE_STATE_KEYS.jobInput]: params.jobInput as Record<
      string,
      unknown
    >,
    [ARTIFACT_PIPELINE_STATE_KEYS.context]: {},
    [ARTIFACT_PIPELINE_STATE_KEYS.draft]: '',
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: params.diagnostics,
    [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [],
    [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: null,
    [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: '',
    [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: null,
    [ARTIFACT_PIPELINE_STATE_KEYS.generationModel]: '',
    [ARTIFACT_PIPELINE_STATE_KEYS.agentModel]: '',
    repair_iteration_count: 0,
    critic_iteration_count: 0,
  };
}
