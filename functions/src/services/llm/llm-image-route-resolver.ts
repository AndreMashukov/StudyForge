import * as functions from 'firebase-functions';
import { LlmSettingsRepository } from './llm-settings-repository';
import { decryptLlmSecret, isLlmEncryptionAvailable } from './llm-secret-resolver';
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_OPENROUTER_IMAGE_MODEL,
  toGeminiImageModel,
} from './llm-image-utils';
import { parseMiniMaxConnection } from './minimax-provider-client';
import type { LlmCapability, ResolvedRoute } from './types';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const GEMINI_IMAGE_FALLBACK: ResolvedRoute = {
  connectionId: 'gemini-primary',
  providerType: 'gemini',
  model: DEFAULT_GEMINI_IMAGE_MODEL,
  fallbackUsed: false,
};

export type LlmImageCapability = Extract<LlmCapability, 'slideDeckImage'>;

export interface ImageRouteResolution {
  route: ResolvedRoute;
  providerApiKey?: string;
  /** Gemini SDK model id used when routing falls back to Gemini */
  geminiImageModel: string;
}

export class LlmImageRouteResolver {
  /**
   * Resolve text-to-image routes for slide deck images.
   * External providers are used when active, configured, and image model is set.
   */
  static async resolve(capability: LlmImageCapability): Promise<ImageRouteResolution> {
    if (capability !== 'slideDeckImage') {
      return {
        route: GEMINI_IMAGE_FALLBACK,
        geminiImageModel: DEFAULT_GEMINI_IMAGE_MODEL,
      };
    }

    try {
      const activeProviderId = await LlmSettingsRepository.getActiveProviderId();

      if (activeProviderId === 'openrouter') {
        return this.resolveOpenRouter(capability);
      }

      if (activeProviderId === 'minimax') {
        return this.resolveMiniMax(capability);
      }

      return {
        route: GEMINI_IMAGE_FALLBACK,
        geminiImageModel: DEFAULT_GEMINI_IMAGE_MODEL,
      };
    } catch (error) {
      functions.logger.error('LlmImageRouteResolver error; using Gemini', {
        capability,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        route: { ...GEMINI_IMAGE_FALLBACK, fallbackUsed: true },
        geminiImageModel: DEFAULT_GEMINI_IMAGE_MODEL,
      };
    }
  }

  private static async resolveOpenRouter(
    capability: LlmImageCapability
  ): Promise<ImageRouteResolution> {
    const connection = await LlmSettingsRepository.getOpenRouterConnection();
    const imageModel =
      connection?.defaultImageModel?.trim() || DEFAULT_OPENROUTER_IMAGE_MODEL;
    const geminiImageModel = toGeminiImageModel(imageModel);

    if (!connection || !connection.enabled || !connection.apiKeyConfigured) {
      functions.logger.info(`LLM image route resolved for ${capability}`, {
        providerType: 'gemini',
        model: geminiImageModel,
        fallbackUsed: false,
      });
      return {
        route: {
          ...GEMINI_IMAGE_FALLBACK,
          model: geminiImageModel,
        },
        geminiImageModel,
      };
    }

    if (!isLlmEncryptionAvailable()) {
      functions.logger.warn(
        'LLM_SETTINGS_ENCRYPTION_KEY not set; using Gemini for slide images',
        { capability }
      );
      return {
        route: { ...GEMINI_IMAGE_FALLBACK, model: geminiImageModel, fallbackUsed: true },
        geminiImageModel,
      };
    }

    const encryptedSecret = await LlmSettingsRepository.getOpenRouterEncryptedSecret();
    if (!encryptedSecret) {
      functions.logger.warn('OpenRouter secret not found; using Gemini for slide images', {
        capability,
      });
      return {
        route: { ...GEMINI_IMAGE_FALLBACK, model: geminiImageModel, fallbackUsed: true },
        geminiImageModel,
      };
    }

    const apiKey = decryptLlmSecret(encryptedSecret);

    const route: ResolvedRoute = {
      connectionId: 'openrouter-primary',
      providerType: 'openrouter',
      model: imageModel,
      fallbackUsed: false,
      openRouterBaseUrl: connection.baseUrl || OPENROUTER_BASE_URL,
    };

    functions.logger.info(`LLM image route resolved for ${capability}`, {
      providerType: route.providerType,
      model: route.model,
      fallbackUsed: route.fallbackUsed,
    });

    return { route, providerApiKey: apiKey, geminiImageModel };
  }

  private static async resolveMiniMax(
    capability: LlmImageCapability
  ): Promise<ImageRouteResolution> {
    const connection = await LlmSettingsRepository.getMiniMaxConnection();
    const parsed = parseMiniMaxConnection(connection);
    const geminiImageModel = DEFAULT_GEMINI_IMAGE_MODEL;

    if (!connection || !connection.enabled || !connection.apiKeyConfigured) {
      functions.logger.info(`LLM image route resolved for ${capability}`, {
        providerType: 'gemini',
        model: geminiImageModel,
        fallbackUsed: false,
      });
      return {
        route: {
          ...GEMINI_IMAGE_FALLBACK,
          model: geminiImageModel,
        },
        geminiImageModel,
      };
    }

    if (!isLlmEncryptionAvailable()) {
      functions.logger.warn(
        'LLM_SETTINGS_ENCRYPTION_KEY not set; using Gemini for slide images',
        { capability }
      );
      return {
        route: { ...GEMINI_IMAGE_FALLBACK, model: geminiImageModel, fallbackUsed: true },
        geminiImageModel,
      };
    }

    const encryptedSecret = await LlmSettingsRepository.getMiniMaxEncryptedSecret();
    if (!encryptedSecret) {
      functions.logger.warn('MiniMax secret not found; using Gemini for slide images', {
        capability,
      });
      return {
        route: { ...GEMINI_IMAGE_FALLBACK, model: geminiImageModel, fallbackUsed: true },
        geminiImageModel,
      };
    }

    const apiKey = decryptLlmSecret(encryptedSecret);

    const route: ResolvedRoute = {
      connectionId: 'minimax-primary',
      providerType: 'minimax',
      model: parsed.defaultImageModel,
      fallbackUsed: false,
      miniMaxBaseUrl: parsed.baseUrl,
      miniMaxImageUrl: parsed.imageGenerationUrl,
    };

    functions.logger.info(`LLM image route resolved for ${capability}`, {
      providerType: route.providerType,
      model: route.model,
      fallbackUsed: route.fallbackUsed,
    });

    return { route, providerApiKey: apiKey, geminiImageModel };
  }
}
