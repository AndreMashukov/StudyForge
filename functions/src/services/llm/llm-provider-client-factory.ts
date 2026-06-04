import type { LlmProviderClient } from './llm-provider-client';
import type { ResolvedRoute } from './types';
import { GeminiProviderClient } from './gemini-provider-client';
import { OpenRouterProviderClient } from './openrouter-provider-client';

export class LlmProviderClientFactory {
  static create(route: ResolvedRoute, openRouterApiKey?: string): LlmProviderClient {
    if (route.providerType === 'openrouter') {
      if (!openRouterApiKey) {
        throw new Error('openRouterApiKey is required for OpenRouter provider');
      }
      return new OpenRouterProviderClient(
        openRouterApiKey,
        route.openRouterBaseUrl ?? 'https://openrouter.ai/api/v1',
        route.connectionId
      );
    }
    return new GeminiProviderClient();
  }
}
