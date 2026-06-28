import type { IGenerationModelUsage } from '@shared-types';
import { LlmGenerationRouteResolver, type GenerationRouteResolution } from './llm-generation-route-resolver';
import type { LlmCapability, ResolvedRoute } from './types';

export function formatGenerationModelLabel(route: ResolvedRoute): string {
  const provider =
    route.providerType === 'openrouter'
      ? 'OpenRouter'
      : route.providerType === 'minimax'
        ? 'MiniMax'
        : 'Gemini';
  return `${provider}: ${route.model}`;
}

export function toGenerationModelUsage(
  resolution: GenerationRouteResolution,
  durationMs?: number
): IGenerationModelUsage {
  return {
    kind: resolution.kind,
    role: 'generation',
    workflow: resolution.workflow,
    modality: resolution.modality,
    providerKind: resolution.route.providerType,
    connectionId: resolution.route.connectionId,
    model: resolution.route.model,
    llmSetupId: resolution.llmSetupId,
    userGroupId: resolution.userGroupId,
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}

export async function resolveTextGenerationAudit(
  userId: string,
  capability: LlmCapability
): Promise<{ generationModel: string; generationModelUsage: IGenerationModelUsage[] }> {
  const resolution = await LlmGenerationRouteResolver.resolve(capability, { userId });
  return {
    generationModel: formatGenerationModelLabel(resolution.route),
    generationModelUsage: [toGenerationModelUsage(resolution)],
  };
}
