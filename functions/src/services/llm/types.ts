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
