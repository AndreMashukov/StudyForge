/**
 * Barrel export for the LangGraph-backed flashcards artifact pipeline.
 *
 * This is the public surface of the `artifact-agent-langgraph/flashcards`
 * module. Callers (Firebase Functions v2 handlers, integration tests)
 * should import from this barrel rather than reaching into individual
 * files.
 *
 * The module is the strangler-fig replacement for the ADK pipeline at
 * the legacy `artifact-agent/` tree (deleted in Phase D of the flashcards
 * migration). After the big-bang cutover, the flashcards endpoint invokes
 * `runFlashcardsLangGraphPipeline` exported here.
 *
 * Flashcards-specific scope:
 *   - Repair-only. There is no critic, no refiner, and no verification
 *     loop. The maximum number of repair iterations
 *     (`FLASHCARDS_MAX_REPAIR_ITERATIONS = 2`) lives in this module.
 *   - Does NOT share nodes or state schema with diagram-quiz. The
 *     dispatcher routes the two artifact kinds to two independent graphs.
 *
 * The locked `session.state` key contract from
 * `../artifact-pipeline-state-keys` is re-exported so callers can read the
 * outcome and failure message keys off the final state without importing
 * the ADK factory.
 *
 * Internal node factories and the graph builder are intentionally NOT
 * re-exported from this barrel; they are implementation details that may
 * evolve as the LangGraph topology is tuned. If a test or external module
 * needs access to the raw `StateGraph` or individual node factories, those
 * modules should import directly from `./flashcards-graph` and
 * `../nodes/...` and document the dependency.
 */
export { runFlashcardsLangGraphPipeline } from './run-flashcards-pipeline';
export type { FlashcardsLangGraphDefinition } from './run-flashcards-pipeline';

// State shape and helpers. Re-exported so callers building checkpointer
// integrations or alternative entry points can reuse the same state
// schema without duplicating the annotation.
export {
  FlashcardsStateAnnotation,
  FlashcardsStateValue,
  createInitialFlashcardsState,
  replaceWithNext,
  keepFiniteNumber,
  FLASHCARDS_LOOP_COUNTERS,
  FLASHCARDS_LOOP_LIMITS,
} from './flashcards-state';
export type {
  FlashcardsState,
  ArtifactPipelineOutcome,
  FlashcardsLoopCounterKey,
} from './flashcards-state';

// Graph topology constants and compiled-graph helper. Exposed for tests
// that want to invoke the graph directly with custom initial states.
export {
  FLASHCARDS_NODE_NAMES,
  FLASHCARDS_MAX_REPAIR_ITERATIONS,
  createFlashcardsStateGraph,
  compileFlashcardsGraph,
  flashcardsGraph,
  routeAfterGate,
} from './flashcards-graph';
export type {
  FlashcardsNodeName,
  RouteAfterGateTarget,
} from './flashcards-graph';

// Re-export the locked `session.state` key contract from the shared
// module so callers do not need to know the relative path.
export {
  ARTIFACT_PIPELINE_STATE_KEYS,
} from '../artifact-pipeline-state-keys';
export type { ArtifactPipelineStateKey } from '../artifact-pipeline-state-keys';
