import type { IArtifactCriticResult, IArtifactAgentDiagnostics } from '@shared-types';
import type { ArtifactAgentContext, ArtifactAgentDefinition } from '../../artifact-agent/artifact-agent-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';

export interface DiagramQuizNodeState {
  [ARTIFACT_PIPELINE_STATE_KEYS.definition]: ArtifactAgentDefinition<unknown, unknown> | undefined;
  [ARTIFACT_PIPELINE_STATE_KEYS.jobInput]: unknown;
  [ARTIFACT_PIPELINE_STATE_KEYS.context]: ArtifactAgentContext | undefined;
  [ARTIFACT_PIPELINE_STATE_KEYS.draft]: unknown;
  [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: IArtifactAgentDiagnostics | undefined;
  [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: unknown[] | undefined;
  [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: IArtifactCriticResult | undefined;
  [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'completed' | 'failed' | undefined;
  [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: string | undefined;
  [ARTIFACT_PIPELINE_STATE_KEYS.generationModel]: string | undefined;
  [ARTIFACT_PIPELINE_STATE_KEYS.agentModel]: string | undefined;
  repair_iteration?: number;
  critic_iteration?: number;
}

export type DiagramQuizNodeUpdate = Partial<DiagramQuizNodeState>;

export async function refinerNode(state: DiagramQuizNodeState): Promise<DiagramQuizNodeUpdate> {
  const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
  const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
  const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context];
  const diagnostics = state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics];
  const result = state[ARTIFACT_PIPELINE_STATE_KEYS.criticResult];

  if (!definition?.refiner || draft === undefined || !context || !diagnostics || !result) return {};
  if (result.overallVerdict === 'pass' || result.overallVerdict === 'fail') return {};

  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.draft]: await definition.refiner.refine(draft, result, context, diagnostics),
  };
}

export default refinerNode;
