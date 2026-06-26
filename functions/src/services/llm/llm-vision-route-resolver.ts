import * as functions from 'firebase-functions';
import { LlmSetupRepository } from './llm-setup-repository';
import type { LlmCapability, ResolvedRoute } from './types';
import type { LlmRouteOptions } from './llm-route-resolver';

export type VisionCapability = Extract<LlmCapability, 'documentFromScreenshot'>;

export interface VisionRouteResolution {
  route: ResolvedRoute;
  providerApiKey?: string;
  userGroupId?: string;
  llmSetupId?: string;
}

export class LlmVisionRouteResolver {
  static async resolve(
    capability: VisionCapability,
    options: LlmRouteOptions
  ): Promise<VisionRouteResolution> {
    if (capability !== 'documentFromScreenshot') {
      throw new Error(`Unsupported vision capability: ${capability}`);
    }

    try {
      const setupResolution = await LlmSetupRepository.resolveModalityRoute(
        options.userId,
        'vision'
      );

      functions.logger.info('LLM vision route resolved', {
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
        userGroupId: setupResolution.userGroupId,
        llmSetupId: setupResolution.llmSetupId,
      };
    } catch (error) {
      functions.logger.error('LlmVisionRouteResolver failed', {
        capability,
        userId: options.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
