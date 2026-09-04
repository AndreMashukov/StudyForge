/**
 * Shared keys for the artifact pipeline session state.
 *
 * This module is the single source of truth for the `session.state` shape
 * consumed by the artifact pipeline. Both the legacy ADK implementation
 * (`libs/backend/artifacts/src/artifact-agent/`) and the LangGraph
 * implementation (`libs/backend/artifacts/src/artifact-agent-langgraph/`)
 * import these keys so that any divergence in the state contract surfaces
 * at compile time rather than at runtime.
 *
 * Contract lock: these string keys are part of the durable Firestore
 * `session.state` shape and must not change without a coordinated
 * migration.
 */

export const ARTIFACT_PIPELINE_STATE_KEYS = {
  definition: 'artifact_definition',
  jobInput: 'job_input',
  context: 'artifact_context',
  draft: 'artifact_draft',
  diagnostics: 'artifact_diagnostics',
  gateFailures: 'artifact_gate_failures',
  criticResult: 'artifact_critic_result',
  outcome: 'artifact_outcome',
  failureMessage: 'artifact_failure_message',
  generationModel: 'artifact_generation_model',
  agentModel: 'artifact_agent_model',
} as const;

export type ArtifactPipelineStateKey =
  (typeof ARTIFACT_PIPELINE_STATE_KEYS)[keyof typeof ARTIFACT_PIPELINE_STATE_KEYS];
