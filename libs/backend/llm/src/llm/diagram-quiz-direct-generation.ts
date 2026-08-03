import type { ScrapedContent } from '@shared-types';
import { GeminiService } from '../gemini/gemini';
import type { DiagramQuizGenerationResponse } from './generation-response-types';

/**
 * One-shot diagram quiz generation via the internal Gemini adapter.
 * Used by chunked generators when the resolved route is Gemini.
 */
export async function generateDiagramQuizDirect(
  content: ScrapedContent,
  additionalPrompt?: string,
): Promise<DiagramQuizGenerationResponse> {
  return GeminiService.generateDiagramQuiz(content, additionalPrompt);
}
