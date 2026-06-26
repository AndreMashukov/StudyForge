import * as functions from 'firebase-functions';
import { LlmSetupRepository } from './llm-setup-repository';
import type { LlmCapability, ResolvedRoute } from './types';

export interface RouteResolution {
  route: ResolvedRoute;
  providerApiKey?: string;
  userGroupId?: string;
  llmSetupId?: string;
}

export interface LlmRouteOptions {
  userId: string;
}

export class LlmRouteResolver {
  /**
   * Resolve text modality route for a capability using the user's group LLM setup.
   */
  static async resolve(
    capability: LlmCapability,
    options: LlmRouteOptions
  ): Promise<RouteResolution> {
    try {
      const setupResolution = await LlmSetupRepository.resolveModalityRoute(
        options.userId,
        'text'
      );

      functions.logger.info('LLM text route resolved', {
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
      functions.logger.error('LlmRouteResolver failed', {
        capability,
        userId: options.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
