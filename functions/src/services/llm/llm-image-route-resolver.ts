import * as functions from 'firebase-functions';
import { LlmSetupRepository } from './llm-setup-repository';
import type { LlmCapability, ResolvedRoute } from './types';
import type { LlmRouteOptions } from './llm-route-resolver';

export type LlmImageCapability = Extract<LlmCapability, 'slideDeckImage'>;

export interface ImageRouteResolution {
  route: ResolvedRoute;
  providerApiKey?: string;
  geminiImageModel: string;
  userGroupId?: string;
  llmSetupId?: string;
}

export class LlmImageRouteResolver {
  static async resolve(
    capability: LlmImageCapability,
    options: LlmRouteOptions
  ): Promise<ImageRouteResolution> {
    if (capability !== 'slideDeckImage') {
      throw new Error(`Unsupported image capability: ${capability}`);
    }

    try {
      const setupResolution = await LlmSetupRepository.resolveModalityRoute(
        options.userId,
        'image'
      );

      const geminiImageModel =
        setupResolution.route.providerType === 'gemini'
          ? setupResolution.route.model
          : setupResolution.route.model;

      functions.logger.info('LLM image route resolved', {
        capability,
        userId: options.userId,
        userGroupId: setupResolution.userGroupId,
        llmSetupId: setupResolution.llmSetupId,
        providerType: setupResolution.route.providerType,
        model: setupResolution.route.model,
      });

      return {
        route: setupResolution.route,
        providerApiKey: setupResolution.providerApiKey,
        geminiImageModel,
        userGroupId: setupResolution.userGroupId,
        llmSetupId: setupResolution.llmSetupId,
      };
    } catch (error) {
      functions.logger.error('LlmImageRouteResolver failed', {
        capability,
        userId: options.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
