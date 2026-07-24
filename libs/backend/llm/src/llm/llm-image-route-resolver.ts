import * as functions from 'firebase-functions';
import { LlmGenerationRouteResolver } from './llm-generation-route-resolver';
import type { LlmCapability } from './types';
import type { LlmRouteOptions } from './llm-route-resolver';

export type LlmImageCapability = Extract<LlmCapability, 'slideDeckImage'>;

export interface ImageRouteResolution {
  route: Awaited<ReturnType<typeof LlmGenerationRouteResolver.resolve>>['route'];
  providerApiKey?: string;
  geminiImageModel: string;
  userGroupId?: string;
  llmSetupId?: string;
}

/** @deprecated Use LlmGenerationRouteResolver */
export class LlmImageRouteResolver {
  static async resolve(
    capability: LlmImageCapability,
    options: LlmRouteOptions
  ): Promise<ImageRouteResolution> {
    if (capability !== 'slideDeckImage') {
      throw new Error(`Unsupported image capability: ${capability}`);
    }

    const resolution = await LlmGenerationRouteResolver.resolve(capability, options);

    functions.logger.info('LLM image route resolved via generation resolver', {
      capability,
      userId: options.userId,
      kind: resolution.kind,
    });

    return {
      route: resolution.route,
      providerApiKey: resolution.providerApiKey,
      geminiImageModel: resolution.route.model,
      userGroupId: resolution.userGroupId,
      llmSetupId: resolution.llmSetupId,
    };
  }
}
