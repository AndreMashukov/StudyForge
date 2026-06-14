import * as functions from 'firebase-functions';
import { LlmSettingsRepository } from './llm-settings-repository';
import { decryptLlmSecret, isLlmEncryptionAvailable } from './llm-secret-resolver';
import { parseMiniMaxConnection } from './minimax-provider-client';
import type { LlmCapability, ResolvedRoute } from './types';

const GEMINI_DEFAULT_MODEL = 'gemini-pro-latest';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const GEMINI_VISION_FALLBACK: ResolvedRoute = {
  connectionId: 'gemini-primary',
  providerType: 'gemini',
  model: GEMINI_DEFAULT_MODEL,
  fallbackUsed: false,
};

export type VisionCapability = Extract<LlmCapability, 'documentFromScreenshot'>;

export interface VisionRouteResolution {
  route: ResolvedRoute;
  providerApiKey?: string;
}

export class LlmVisionRouteResolver {
  /**
   * Resolve vision (image-in → text-out) routes.
   * External providers are used only when active, configured, and vision model is set.
   */
  static async resolve(capability: VisionCapability): Promise<VisionRouteResolution> {
    if (capability !== 'documentFromScreenshot') {
      return { route: GEMINI_VISION_FALLBACK };
    }

    try {
      const activeProviderId = await LlmSettingsRepository.getActiveProviderId();

      if (activeProviderId === 'openrouter') {
        return this.resolveOpenRouter(capability);
      }

      if (activeProviderId === 'minimax') {
        return this.resolveMiniMax(capability);
      }

      return { route: GEMINI_VISION_FALLBACK };
    } catch (error) {
      functions.logger.error('LlmVisionRouteResolver error; using Gemini', {
        capability,
        error: error instanceof Error ? error.message : String(error),
      });
      return { route: { ...GEMINI_VISION_FALLBACK, fallbackUsed: true } };
    }
  }

  private static async resolveOpenRouter(
    capability: VisionCapability
  ): Promise<VisionRouteResolution> {
    const connection = await LlmSettingsRepository.getOpenRouterConnection();
    const visionModel = connection?.defaultVisionModel?.trim();

    if (
      !connection ||
      !connection.enabled ||
      !connection.apiKeyConfigured ||
      !visionModel
    ) {
      if (connection?.enabled && connection.apiKeyConfigured && !visionModel) {
        functions.logger.warn(
          'OpenRouter vision model not configured; using Gemini for screenshot',
          { capability }
        );
      }
      return {
        route: { ...GEMINI_VISION_FALLBACK, fallbackUsed: !!connection?.enabled },
      };
    }

    if (!isLlmEncryptionAvailable()) {
      functions.logger.warn(
        'LLM_SETTINGS_ENCRYPTION_KEY not set; using Gemini for screenshot vision',
        { capability }
      );
      return { route: { ...GEMINI_VISION_FALLBACK, fallbackUsed: true } };
    }

    const encryptedSecret = await LlmSettingsRepository.getOpenRouterEncryptedSecret();
    if (!encryptedSecret) {
      functions.logger.warn('OpenRouter secret not found; using Gemini for screenshot vision', {
        capability,
      });
      return { route: { ...GEMINI_VISION_FALLBACK, fallbackUsed: true } };
    }

    const apiKey = decryptLlmSecret(encryptedSecret);

    const route: ResolvedRoute = {
      connectionId: 'openrouter-primary',
      providerType: 'openrouter',
      model: visionModel,
      fallbackUsed: false,
      openRouterBaseUrl: connection.baseUrl || OPENROUTER_BASE_URL,
    };

    functions.logger.info(`LLM vision route resolved for ${capability}`, {
      providerType: route.providerType,
      model: route.model,
      fallbackUsed: route.fallbackUsed,
    });

    return { route, providerApiKey: apiKey };
  }

  private static async resolveMiniMax(
    capability: VisionCapability
  ): Promise<VisionRouteResolution> {
    const connection = await LlmSettingsRepository.getMiniMaxConnection();
    const parsed = parseMiniMaxConnection(connection);
    const visionModel = parsed.defaultVisionModel;

    if (!connection || !connection.enabled || !connection.apiKeyConfigured) {
      return {
        route: { ...GEMINI_VISION_FALLBACK, fallbackUsed: !!connection?.enabled },
      };
    }

    if (!isLlmEncryptionAvailable()) {
      functions.logger.warn(
        'LLM_SETTINGS_ENCRYPTION_KEY not set; using Gemini for screenshot vision',
        { capability }
      );
      return { route: { ...GEMINI_VISION_FALLBACK, fallbackUsed: true } };
    }

    const encryptedSecret = await LlmSettingsRepository.getMiniMaxEncryptedSecret();
    if (!encryptedSecret) {
      functions.logger.warn('MiniMax secret not found; using Gemini for screenshot vision', {
        capability,
      });
      return { route: { ...GEMINI_VISION_FALLBACK, fallbackUsed: true } };
    }

    const apiKey = decryptLlmSecret(encryptedSecret);

    const route: ResolvedRoute = {
      connectionId: 'minimax-primary',
      providerType: 'minimax',
      model: visionModel,
      fallbackUsed: false,
      miniMaxBaseUrl: parsed.baseUrl,
      miniMaxImageUrl: parsed.imageGenerationUrl,
    };

    functions.logger.info(`LLM vision route resolved for ${capability}`, {
      providerType: route.providerType,
      model: route.model,
      fallbackUsed: route.fallbackUsed,
    });

    return { route, providerApiKey: apiKey };
  }
}
