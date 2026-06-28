import * as functions from 'firebase-functions';
import { LlmGenerationRouteResolver } from './llm-generation-route-resolver';
import type { LlmCapability } from './types';
import type { LlmRouteOptions } from './llm-route-resolver';

export type LlmVisionCapability = Extract<LlmCapability, 'documentFromScreenshot'>;

/** @deprecated Use LlmGenerationRouteResolver */
export class LlmVisionRouteResolver {
  static async resolve(capability: LlmVisionCapability, options: LlmRouteOptions) {
    if (capability !== 'documentFromScreenshot') {
      throw new Error(`Unsupported vision capability: ${capability}`);
    }

    const resolution = await LlmGenerationRouteResolver.resolve(capability, options);

    functions.logger.info('LLM vision route resolved via generation resolver', {
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
