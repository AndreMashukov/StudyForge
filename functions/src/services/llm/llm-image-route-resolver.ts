import * as functions from 'firebase-functions';
import { LlmSettingsRepository } from './llm-settings-repository';
import type { LlmCapability, ResolvedRoute } from './types';

const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

const GEMINI_IMAGE_FALLBACK: ResolvedRoute = {
  connectionId: 'gemini-image-primary',
  providerType: 'gemini',
  model: DEFAULT_GEMINI_IMAGE_MODEL,
  fallbackUsed: false,
};

export type LlmImageCapability = Extract<
  LlmCapability,
  'slideDeckImage' | 'documentFromScreenshot'
>;

export class LlmImageRouteResolver {
  /**
   * Image and multimodal flows use Gemini image models from admin config.
   * OpenRouter text defaults are never used for image bytes.
   */
  static async resolve(capability: LlmImageCapability): Promise<ResolvedRoute> {
    try {
      const connection = await LlmSettingsRepository.getGeminiImageConnection();
      if (!connection || connection.enabled === false) {
        functions.logger.info('LLM image route resolved (defaults)', {
          capability,
          providerType: GEMINI_IMAGE_FALLBACK.providerType,
          model: GEMINI_IMAGE_FALLBACK.model,
        });
        return GEMINI_IMAGE_FALLBACK;
      }

      const route: ResolvedRoute = {
        connectionId: 'gemini-image-primary',
        providerType: 'gemini',
        model: connection.defaultModel?.trim() || DEFAULT_GEMINI_IMAGE_MODEL,
        fallbackUsed: false,
      };

      functions.logger.info('LLM image route resolved', {
        capability,
        providerType: route.providerType,
        model: route.model,
      });

      return route;
    } catch (error) {
      functions.logger.warn('LlmImageRouteResolver error; using default image model', {
        capability,
        error: error instanceof Error ? error.message : String(error),
      });
      return { ...GEMINI_IMAGE_FALLBACK, fallbackUsed: true };
    }
  }
}
