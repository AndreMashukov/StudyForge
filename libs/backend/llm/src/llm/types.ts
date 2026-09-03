/**
 * Internal types for the LLM routing/provider layer.
 * Public-facing shared types (LlmCapabilityKey, IOpenRouterProviderConnection, …)
 * live in @shared-types.
 */

import type { IProviderUsageUnits } from '@shared-types';

export type LlmCapability =
  | 'quiz'
  | 'flashcards'
  | 'documentFromPrompt'
  | 'documentFromScreenshot'
  | 'quizFollowup'
  | 'documentQuestion'
  | 'documentRevise'
  | 'directoryChat'
  | 'diagramQuiz'
  | 'diagramQuizAgent'
  | 'sequenceQuiz'
  | 'matchQuiz'
  | 'slideDeckText'
  | 'slideDeckImage'
  | 'sourceDocumentEnhancement'
  | 'ruleGeneration'
  | 'directoryAgent'
  | 'agentExecutor'
  | 'agentKnowledgeEmbedding';

export interface LlmTextConfig {
  model: string;
  requestTimeoutMs?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  /** Gemini: force JSON object responses when supported. */
  responseMimeType?: 'application/json' | 'text/plain';
  /** Gemini structured-output schema (used with application/json). */
  responseSchema?: Record<string, unknown>;
  /**
   * Gemini thinking budget in tokens. 0 disables when the model allows it;
   * omit to keep model defaults.
   */
  thinkingBudget?: number;
  /**
   * Prefer non-reasoning / non-thinking mode for structured, latency-sensitive
   * generation (Together `reasoning.enabled=false`, MiniMax `thinking.disabled`,
   * Gemini `thinkingBudget=0` when unset).
   */
  disableReasoning?: boolean;
}

export interface LlmTextRequest {
  prompt: string;
  config: LlmTextConfig;
}

/** Options for {@link LlmGenerationService.generateText}. */
export interface IGenerateTextOptions {
  logLabel?: string;
  successLogMessage?: string;
  requestTimeoutMs?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
  /**
   * Prefer non-reasoning mode for structured / latency-sensitive text
   * (Together `reasoning.enabled=false`, MiniMax thinking disabled, etc.).
   */
  disableReasoning?: boolean;
  thinkingBudget?: number;
  profile?: import('@shared-types').LlmGenerationProfileId;
  flow?: import('@shared-types').LlmGenerationFlowId;
}

export type LlmVisionDetail = 'auto' | 'low' | 'high';

export interface LlmVisionRequest {
  prompt: string;
  /** Full data URL or raw base64; normalized by caller */
  imageDataUrl: string;
  config: LlmTextConfig;
  detail?: LlmVisionDetail;
}

export interface ILlmProviderCallMeta {
  usage?: IProviderUsageUnits;
  finishReason?: string;
  durationMs?: number;
}

export interface LlmVisionResult extends ILlmProviderCallMeta {
  text: string;
  model: string;
  providerType: 'gemini' | 'openrouter' | 'minimax' | 'together';
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

export interface LlmImageResult extends ILlmProviderCallMeta {
  imageBase64: string;
  model: string;
  providerType: 'gemini' | 'openrouter' | 'minimax' | 'together';
  connectionId: string;
}

export interface LlmTextResult extends ILlmProviderCallMeta {
  text: string;
  model: string;
  providerType: 'gemini' | 'openrouter' | 'minimax' | 'together';
  connectionId: string;
}

export interface ResolvedRoute {
  connectionId: string;
  providerType: 'gemini' | 'openrouter' | 'minimax' | 'together';
  model: string;
  fallbackUsed: boolean;
  openRouterBaseUrl?: string;
  miniMaxBaseUrl?: string;
  miniMaxImageUrl?: string;
  togetherBaseUrl?: string;
}
