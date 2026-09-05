/**
 * Barrel export for the LangGraph-backed diagram-quiz artifact pipeline.
 *
 * This is the public surface of the `artifact-agent-langgraph` module.
 * Callers (Firebase Functions v2 handlers, integration tests) should
 * import from this barrel rather than reaching into individual files.
 *
 * The module is the strangler-fig replacement for the ADK pipeline at
 * `../artifact-agent`. After the big-bang cutover, the diagram-quiz
 * endpoint invokes `runDiagramQuizLangGraphPipeline` exported here.
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
 * modules should import directly from `./diagram-quiz-graph` and
 * `./nodes/...` and document the dependency.
 */
export { runDiagramQuizLangGraphPipeline } from './run-diagram-quiz-pipeline';
export type { DiagramQuizLangGraphDefinition } from './run-diagram-quiz-pipeline';

// State shape and helpers. Re-exported so callers building checkpointer
// integrations or alternative entry points can reuse the same state
// schema without duplicating the annotation.
export {
  DiagramQuizStateAnnotation,
  createInitialDiagramQuizState,
  mergeDiagnostics,
  incrementCounter,
  DIAGRAM_QUIZ_LOOP_COUNTERS,
  DIAGRAM_QUIZ_LOOP_LIMITS,
} from './diagram-quiz-state';
export type {
  DiagramQuizState,
  ArtifactPipelineOutcome,
  DiagramQuizLoopCounterKey,
} from './diagram-quiz-state';

// Graph topology constants and compiled-graph helper. Exposed for tests
// that want to invoke the graph directly with custom initial states.
export {
  DIAGRAM_QUIZ_NODE_NAMES,
  createDiagramQuizStateGraph,
  compileDiagramQuizGraph,
} from './diagram-quiz-graph';
export type { DiagramQuizNodeName } from './diagram-quiz-graph';

// Re-export the locked `session.state` key contract from the shared
// module so callers do not need to know the relative path.
export {
  ARTIFACT_PIPELINE_STATE_KEYS,
} from '../artifact-pipeline-state-keys';
export type { ArtifactPipelineStateKey } from '../artifact-pipeline-state-keys';