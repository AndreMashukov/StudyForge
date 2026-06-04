import type { LlmTextRequest, LlmTextResult } from './types';

export interface LlmProviderClient {
  generateText(request: LlmTextRequest): Promise<LlmTextResult>;
}
