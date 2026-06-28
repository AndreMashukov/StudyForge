import * as functions from 'firebase-functions';
import { LlmGenerationRouteResolver } from './llm-generation-route-resolver';
import type { LlmCapability } from './types';

export interface LlmRouteOptions {
  userId: string;
}

/** @deprecated Use LlmGenerationRouteResolver */
export class LlmRouteResolver {
  static async resolve(capability: LlmCapability, options: LlmRouteOptions) {
    const resolution = await LlmGenerationRouteResolver.resolve(capability, options);

    functions.logger.info('LLM text route resolved via generation resolver', {
      capability,
      userId: options.userId,
      kind: resolution.kind,
    });

    return {
      route: resolution.route,
      providerApiKey: resolution.providerApiKey,
      userGroupId: resolution.userGroupId,
      llmSetupId: resolution.llmSetupId,
    };
  }
}

export type { GenerationRouteResolution as RouteResolution } from './llm-generation-route-resolver';
