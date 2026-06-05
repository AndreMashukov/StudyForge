import type {
  LlmImageRequest,
  LlmImageResult,
  LlmTextRequest,
  LlmTextResult,
  LlmVisionRequest,
  LlmVisionResult,
} from './types';

export interface LlmProviderClient {
  generateText(request: LlmTextRequest): Promise<LlmTextResult>;
  generateVisionText(request: LlmVisionRequest): Promise<LlmVisionResult>;
  generateImage(request: LlmImageRequest): Promise<LlmImageResult>;
}
