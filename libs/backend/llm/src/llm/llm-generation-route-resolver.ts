import * as functions from 'firebase-functions';
import type { GenerationKind } from '@shared-types';
import { resolveGenerationKind } from '@shared-types';
import { LlmSetupRepository, type SetupGenerationRouteResolution } from './llm-setup-repository';
import type { LlmCapability, ResolvedRoute } from './types';

export interface GenerationRouteResolution {
  route: ResolvedRoute;
  providerApiKey?: string;
  userGroupId: string;
  llmSetupId: string;
  kind: GenerationKind;
  workflow: SetupGenerationRouteResolution['workflow'];
  modality: SetupGenerationRouteResolution['modality'];
}

export interface LlmGenerationRouteOptions {
  userId: string;
}

export class LlmGenerationRouteResolver {
  static async resolve(
    capability: LlmCapability | string,
    options: LlmGenerationRouteOptions
  ): Promise<GenerationRouteResolution> {
    const kind = resolveGenerationKind(capability);

    try {
      const setupResolution = await LlmSetupRepository.resolveGenerationRoute(
        options.userId,
        kind
      );

      functions.logger.info('LLM generation route resolved', {
        capability,
        kind,
        userId: options.userId,
        userGroupId: setupResolution.userGroupId,
        llmSetupId: setupResolution.llmSetupId,
        workflow: setupResolution.workflow,
        modality: setupResolution.modality,
        providerType: setupResolution.route.providerType,
        model: setupResolution.route.model,
      });

      return setupResolution;
    } catch (error) {
      functions.logger.error('LlmGenerationRouteResolver failed', {
        capability,
        kind,
        userId: options.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
