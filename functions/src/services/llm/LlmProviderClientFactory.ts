import type { LlmProviderClient } from './LlmProviderClient';
import type { ResolvedRoute } from './types';
import { GeminiProviderClient } from './GeminiProviderClient';
import { OpenRouterProviderClient } from './OpenRouterProviderClient';

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
