import * as functions from 'firebase-functions';
import { LlmGenerationRouteResolver, type GenerationRouteResolution } from './llm-generation-route-resolver';
import type { LlmCapability, LlmTextConfig } from './types';
import { LlmProviderClientFactory } from './llm-provider-client-factory';

export interface TextRouteContext {
  resolution: GenerationRouteResolution;
  usesExternalProvider: boolean;
}

export async function resolveTextRoute(
  userId: string,
  capability: LlmCapability,
  logLabel: string
): Promise<TextRouteContext> {
  const resolution = await LlmGenerationRouteResolver.resolve(capability, { userId });

  functions.logger.info(`LLM route resolved for ${logLabel}`, {
    userId,
    capability,
    kind: resolution.kind,
    providerType: resolution.route.providerType,
    model: resolution.route.model,
    userGroupId: resolution.userGroupId,
    llmSetupId: resolution.llmSetupId,
    workflow: resolution.workflow,
  });

  return {
    resolution,
    usesExternalProvider: resolution.route.providerType !== 'gemini',
  };
}

export async function generateExternalProviderText(
  ctx: TextRouteContext,
  prompt: string,
  config: LlmTextConfig,
  successLogMessage: string
): Promise<string> {
  const client = LlmProviderClientFactory.create(
    ctx.resolution.route,
    ctx.resolution.providerApiKey
  );
  const result = await client.generateText({ prompt, config });

  functions.logger.info(successLogMessage, {
    model: result.model,
    responseLength: result.text.length,
  });

  return result.text;
}

/** @deprecated Use generateExternalProviderText */
export const generateOpenRouterText = generateExternalProviderText;

/** @deprecated Use usesExternalProvider */
export function usesOpenRouter(ctx: TextRouteContext): boolean {
  return ctx.usesExternalProvider;
}
