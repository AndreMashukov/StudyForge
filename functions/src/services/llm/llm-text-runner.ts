import * as functions from 'firebase-functions';
import { LlmProviderClientFactory } from './llm-provider-client-factory';
import { LlmRouteResolver, type RouteResolution } from './llm-route-resolver';
import type { LlmCapability, LlmTextConfig } from './types';

export interface TextRouteContext {
  resolution: RouteResolution;
  usesExternalProvider: boolean;
}

export async function resolveTextRoute(
  userId: string,
  capability: LlmCapability,
  logLabel: string
): Promise<TextRouteContext> {
  const resolution = await LlmRouteResolver.resolve(capability, { userId });

  functions.logger.info(`LLM route resolved for ${logLabel}`, {
    userId,
    capability,
    providerType: resolution.route.providerType,
    model: resolution.route.model,
    userGroupId: resolution.userGroupId,
    llmSetupId: resolution.llmSetupId,
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
