import * as functions from 'firebase-functions';
import {
  LlmGenerationRouteResolver,
  type GenerationRouteResolution,
} from './llm-generation-route-resolver';
import type { LlmCapability, LlmTextConfig } from './types';
import { LlmProviderClientFactory } from './llm-provider-client-factory';
import {
  applyLlmGenerationDefaults,
  type IApplyLlmGenerationDefaultsOptions,
} from './llm-generation-settings-repository';
import {
  trackLlmProviderError,
  trackLlmProviderTextResult,
} from './llm-provider-call-tracking';

export interface TextRouteContext {
  resolution: GenerationRouteResolution;
  usesExternalProvider: boolean;
}

export async function resolveTextRoute(
  userId: string,
  capability: LlmCapability,
  logLabel: string,
): Promise<TextRouteContext> {
  const resolution = await LlmGenerationRouteResolver.resolve(capability, {
    userId,
  });

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

export type IExternalProviderTextOptions = IApplyLlmGenerationDefaultsOptions;

export async function buildRoutedTextConfig(
  model: string,
  options?: IApplyLlmGenerationDefaultsOptions & Partial<LlmTextConfig>,
): Promise<LlmTextConfig> {
  const { profile, flow, ...overrides } = options ?? {};
  return applyLlmGenerationDefaults({ model, ...overrides }, { profile, flow });
}

export async function generateExternalProviderText(
  ctx: TextRouteContext,
  prompt: string,
  config: LlmTextConfig,
  successLogMessage: string,
  options?: IExternalProviderTextOptions,
): Promise<string> {
  const configWithDefaults = await applyLlmGenerationDefaults(config, options);
  const client = LlmProviderClientFactory.create(
    ctx.resolution.route,
    ctx.resolution.providerApiKey,
  );
  const startedAt = Date.now();
  try {
    const result = await client.generateText({
      prompt,
      config: configWithDefaults,
    });

    if (result.providerType !== 'gemini') {
      await trackLlmProviderTextResult(result, { startedAt });
    }

    functions.logger.info(successLogMessage, {
      model: result.model,
      responseLength: result.text.length,
    });

    return result.text;
  } catch (error) {
    await trackLlmProviderError({
      providerKind: ctx.resolution.route.providerType,
      connectionId: ctx.resolution.route.connectionId,
      model: ctx.resolution.route.model,
      modality: 'text',
      startedAt,
    });
    throw error;
  }
}

/** @deprecated Use generateExternalProviderText */
export const generateOpenRouterText = generateExternalProviderText;

/** @deprecated Use usesExternalProvider */
export function usesOpenRouter(ctx: TextRouteContext): boolean {
  return ctx.usesExternalProvider;
}
