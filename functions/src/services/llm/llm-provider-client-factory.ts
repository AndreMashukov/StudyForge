import type { LlmProviderClient } from './llm-provider-client';
import type { ResolvedRoute } from './types';
import { GeminiProviderClient } from './gemini-provider-client';
import { MiniMaxProviderClient } from './minimax-provider-client';
import { OpenRouterProviderClient } from './openrouter-provider-client';

export class LlmProviderClientFactory {
  static create(route: ResolvedRoute, providerApiKey?: string): LlmProviderClient {
    if (route.providerType === 'openrouter') {
      if (!providerApiKey) {
        throw new Error('providerApiKey is required for OpenRouter provider');
      }
      return new OpenRouterProviderClient(
        providerApiKey,
        route.openRouterBaseUrl ?? 'https://openrouter.ai/api/v1',
        route.connectionId
      );
    }

    if (route.providerType === 'minimax') {
      if (!providerApiKey) {
        throw new Error('providerApiKey is required for MiniMax provider');
      }
      return new MiniMaxProviderClient(
        providerApiKey,
        route.miniMaxBaseUrl ?? 'https://api.minimax.io/v1',
        route.miniMaxImageUrl ?? 'https://api.minimax.io/v1/image_generation',
        route.connectionId
      );
    }

    if (!providerApiKey) {
      throw new Error('providerApiKey is required for Gemini provider');
    }

    return new GeminiProviderClient(providerApiKey, route.connectionId);
  }
}
