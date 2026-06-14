import * as functions from 'firebase-functions';
import { LlmRouteResolver, type RouteResolution } from './llm-route-resolver';
import { LlmProviderClientFactory } from './llm-provider-client-factory';
import type { LlmCapability, LlmTextConfig } from './types';

export interface TextRouteContext {
  resolution: RouteResolution;
  usesExternalProvider: boolean;
}

export async function resolveTextRoute(
  capability: LlmCapability,
  logLabel: string
): Promise<TextRouteContext> {
  const resolution = await LlmRouteResolver.resolve(capability);

  functions.logger.info(`LLM route resolved for ${logLabel}`, {
    capability,
    providerType: resolution.route.providerType,
    model: resolution.route.model,
    fallbackUsed: resolution.route.fallbackUsed,
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
