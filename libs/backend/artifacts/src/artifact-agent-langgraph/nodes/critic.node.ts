import type { IArtifactAgentDiagnostics } from '@shared-types';
import type { ArtifactAgentContext, ArtifactAgentDefinition } from '../../artifact-agent/artifact-agent-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { DiagramQuizNodeState, DiagramQuizNodeUpdate } from './refiner.node';

export async function criticNode(state: DiagramQuizNodeState): Promise<DiagramQuizNodeUpdate> {
  const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
  const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
  const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context];
  const diagnostics = state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics];

  if (!definition?.critic || draft === undefined || !context || !diagnostics) return {};

  const criticResult = await definition.critic.criticize(draft, context, diagnostics);
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: criticResult,
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: {
      ...diagnostics,
      criticCycles: (diagnostics.criticCycles ?? 0) + 1,
      criticIssues: criticResult,
    },
    critic_iteration: (state.critic_iteration ?? 0) + 1,
  };
}

export default criticNode;
