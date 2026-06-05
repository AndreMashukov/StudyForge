/**
 * Internal types for the LLM routing/provider layer.
 * Public-facing shared types (LlmCapabilityKey, IOpenRouterProviderConnection, …)
 * live in @shared-types.
 */

export type LlmCapability =
  | 'quiz'
  | 'flashcards'
  | 'documentFromPrompt'
  | 'documentFromScreenshot'
  | 'quizFollowup'
  | 'documentQuestion'
  | 'directoryChat'
  | 'diagramQuiz'
  | 'sequenceQuiz'
  | 'slideDeckText'
  | 'slideDeckImage'
  | 'sourceDocumentEnhancement'
  | 'ruleGeneration';

export interface LlmTextConfig {
  model: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
}

export interface LlmTextRequest {
  prompt: string;
  config: LlmTextConfig;
}

export type LlmVisionDetail = 'auto' | 'low' | 'high';

export interface LlmVisionRequest {
  prompt: string;
  /** Full data URL or raw base64; normalized by caller */
  imageDataUrl: string;
  config: LlmTextConfig;
  detail?: LlmVisionDetail;
}

export interface LlmVisionResult {
  text: string;
  model: string;
  providerType: 'gemini' | 'openrouter';
  connectionId: string;
}

export interface LlmImageConfig {
  aspectRatio?: string;
  imageSize?: string;
}

export interface LlmImageRequest {
  prompt: string;
  config: LlmTextConfig;
  imageConfig?: LlmImageConfig;
}

export interface LlmImageResult {
  imageBase64: string;
  model: string;
  providerType: 'gemini' | 'openrouter';
  connectionId: string;
}

export interface LlmTextResult {
  text: string;
  model: string;
  providerType: 'gemini' | 'openrouter';
  connectionId: string;
}

export interface ResolvedRoute {
  connectionId: string;
  providerType: 'gemini' | 'openrouter';
  model: string;
  fallbackUsed: boolean;
  openRouterBaseUrl?: string;
}
