import * as functions from 'firebase-functions';
import { LlmSettingsRepository } from './llm-settings-repository';
import { decryptLlmSecret, isLlmEncryptionAvailable } from './llm-secret-resolver';
import { parseMiniMaxConnection } from './minimax-provider-client';
import type { LlmCapability, ResolvedRoute } from './types';

const GEMINI_DEFAULT_MODEL = 'gemini-pro-latest';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** Text-only capabilities that may route to an external provider when active. */
const EXTERNAL_TEXT_ELIGIBLE: Set<LlmCapability> = new Set([
  'quiz',
  'flashcards',
  'documentFromPrompt',
  'quizFollowup',
  'documentQuestion',
  'directoryChat',
  'diagramQuiz',
  'diagramQuizAgent',
  'sequenceQuiz',
  'subjectWorld',
  'slideDeckText',
  'sourceDocumentEnhancement',
  'ruleGeneration',
]);

const GEMINI_FALLBACK: ResolvedRoute = {
  connectionId: 'gemini-primary',
  providerType: 'gemini',
  model: GEMINI_DEFAULT_MODEL,
  fallbackUsed: false,
};

export interface RouteResolution {
  route: ResolvedRoute;
  providerApiKey?: string;
}

export class LlmRouteResolver {
  /**
   * Resolve which provider + model to use for a given capability.
   * Falls back to Gemini if the active provider is not configured or any step fails.
   */
  static async resolve(capability: LlmCapability): Promise<RouteResolution> {
    if (!EXTERNAL_TEXT_ELIGIBLE.has(capability)) {
      return { route: GEMINI_FALLBACK };
    }

    try {
      const activeProviderId = await LlmSettingsRepository.getActiveProviderId();

      if (activeProviderId === 'openrouter') {
        return this.resolveOpenRouter(capability);
      }

      if (activeProviderId === 'minimax') {
        return this.resolveMiniMax(capability);
      }

      return { route: GEMINI_FALLBACK };
    } catch (error) {
      functions.logger.error('LlmRouteResolver error; falling back to Gemini', {
        capability,
        error: error instanceof Error ? error.message : String(error),
      });
      return { route: { ...GEMINI_FALLBACK, fallbackUsed: true } };
    }
  }

  private static async resolveOpenRouter(
    capability: LlmCapability
  ): Promise<RouteResolution> {
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
      providerApiKey: apiKey,
    };
  }

  private static async resolveMiniMax(
    capability: LlmCapability
  ): Promise<RouteResolution> {
    const connection = await LlmSettingsRepository.getMiniMaxConnection();
    const parsed = parseMiniMaxConnection(connection);

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

    const encryptedSecret = await LlmSettingsRepository.getMiniMaxEncryptedSecret();
    if (!encryptedSecret) {
      functions.logger.warn('MiniMax secret document not found; using Gemini', {
        capability,
      });
      return { route: { ...GEMINI_FALLBACK, fallbackUsed: true } };
    }

    const apiKey = decryptLlmSecret(encryptedSecret);

    return {
      route: {
        connectionId: 'minimax-primary',
        providerType: 'minimax',
        model: parsed.defaultModel,
        fallbackUsed: false,
        miniMaxBaseUrl: parsed.baseUrl,
        miniMaxImageUrl: parsed.imageGenerationUrl,
      },
      providerApiKey: apiKey,
    };
  }
}
