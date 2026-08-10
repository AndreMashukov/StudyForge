import type { ScrapedContent } from '@shared-types';
import { GeminiService } from '../gemini/gemini';
import type { DiagramQuizGenerationResponse } from './generation-response-types';
import { applyLlmGenerationDefaults } from './llm-generation-settings-repository';
import { resolveLlmGenerationProfile } from './llm-generation-profile-map';

/**
 * One-shot diagram quiz generation via the internal Gemini adapter.
 * Used by chunked generators when the resolved route is Gemini.
 */
export async function generateDiagramQuizDirect(
  content: ScrapedContent,
  additionalPrompt?: string,
  model?: string,
): Promise<DiagramQuizGenerationResponse> {
  const profile =
    resolveLlmGenerationProfile('diagramQuiz') ?? 'structuredArtifact';
  const runtimeConfig = await applyLlmGenerationDefaults(
    { model: model ?? 'gemini-pro-latest' },
    { profile },
  );

  return GeminiService.generateDiagramQuiz(content, additionalPrompt, {
    model: runtimeConfig.model,
    temperature: runtimeConfig.temperature,
    topK: runtimeConfig.topK,
    topP: runtimeConfig.topP,
    maxOutputTokens: runtimeConfig.maxOutputTokens,
    disableReasoning: runtimeConfig.disableReasoning,
    thinkingBudget: runtimeConfig.thinkingBudget,
  });
}
