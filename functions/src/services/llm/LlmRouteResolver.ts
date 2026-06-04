import * as functions from 'firebase-functions';
import { LlmSettingsRepository } from './LlmSettingsRepository';
import { decryptLlmSecret, isLlmEncryptionAvailable } from './LlmSecretResolver';
import type { LlmCapability, ResolvedRoute } from './types';

const GEMINI_DEFAULT_MODEL = 'gemini-pro-latest';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Capabilities that can be routed to OpenRouter when it is enabled.
 * Other capabilities always use Gemini.
 */
const OPENROUTER_ELIGIBLE: Set<LlmCapability> = new Set([
  'quiz',
  'flashcards',
  'documentFromPrompt',
]);

const GEMINI_FALLBACK: ResolvedRoute = {
  connectionId: 'gemini-primary',
  providerType: 'gemini',
  model: GEMINI_DEFAULT_MODEL,
  fallbackUsed: false,
};

export interface RouteResolution {
  route: ResolvedRoute;
  openRouterApiKey?: string;
}

export class LlmRouteResolver {
  /**
   * Resolve which provider + model to use for a given capability.
   * Falls back to Gemini if OpenRouter is not configured, not enabled, or if
   * any step fails (so existing behaviour is never broken).
   */
  static async resolve(capability: LlmCapability): Promise<RouteResolution> {
    if (!OPENROUTER_ELIGIBLE.has(capability)) {
      return { route: GEMINI_FALLBACK };
    }

    try {
      const connection = await LlmSettingsRepository.getOpenRouterConnection();
      if (!connection || !connection.enabled || !connection.apiKeyConfigured) {
        return { route: GEMINI_FALLBACK };
      }

      if (!isLlmEncryptionAvailable()) {
        functions.logger.warn(
          'LLM_SETTINGS_ENCRYPTION_KEY not set in this function; using Gemini',
          { capability }
        );
        return { route: { ...GEMINI_FALLBACK, fallbackUsed: true } };
      }

      const encryptedSecret = await LlmSettingsRepository.getOpenRouterEncryptedSecret();
      if (!encryptedSecret) {
        functions.logger.warn('OpenRouter secret document not found; using Gemini', {
          capability,
        });
        return { route: { ...GEMINI_FALLBACK, fallbackUsed: true } };
      }

      const apiKey = decryptLlmSecret(encryptedSecret);

      return {
        route: {
          connectionId: 'openrouter-primary',
          providerType: 'openrouter',
          model: connection.defaultModel,
          fallbackUsed: false,
          openRouterBaseUrl: connection.baseUrl || OPENROUTER_BASE_URL,
        },
        openRouterApiKey: apiKey,
      };
    } catch (error) {
      functions.logger.error('LlmRouteResolver error; falling back to Gemini', {
        capability,
        error: error instanceof Error ? error.message : String(error),
      });
      return { route: { ...GEMINI_FALLBACK, fallbackUsed: true } };
    }
  }
}
