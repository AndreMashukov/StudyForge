import * as functions from 'firebase-functions';
import type { ScrapedContent, IFileContent } from '@shared-types';
import { GeminiService, JsonSanitizer } from '../gemini';
import type { GeminiQuizResponse } from '../gemini/gemini';
import {
  QuizPromptBuilder,
  FlashcardPromptBuilder,
  DocumentPromptBuilder,
} from '../gemini/prompt-builder';
import {
  buildPromptWithContextFiles,
  validateContextFiles,
  estimateContextTokens,
} from '../gemini/prompt-builder/withContextFiles';
import { LlmRouteResolver } from './LlmRouteResolver';
import { LlmProviderClientFactory } from './LlmProviderClientFactory';
import type { LlmCapability } from './types';

type FlashcardItem = { front: string; back: string; description?: string };

/**
 * Strip outer markdown code fences from a model response.
 * Handles ```json ... ``` and ``` ... ``` wrappers.
 */
function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

/**
 * Parse an OpenRouter quiz JSON response into GeminiQuizResponse.
 * Uses the same JsonSanitizer pipeline that GeminiService uses internally.
 */
function parseQuizJson(raw: string): GeminiQuizResponse {
  let cleaned = '';
  try {
    cleaned = JsonSanitizer.initialCleanup(raw);
    cleaned = JsonSanitizer.sanitizeJsonText(cleaned);
    cleaned = JsonSanitizer.applyComprehensiveCleanup(cleaned);
    cleaned = JsonSanitizer.applyStateBased(cleaned);
    const parsed = JSON.parse(cleaned);
    if (!parsed.title || !Array.isArray(parsed.questions)) {
      throw new Error('Missing title or questions array in quiz response');
    }
    return parsed as GeminiQuizResponse;
  } catch (err) {
    JsonSanitizer.logParsingError(err, raw, cleaned);
    try {
      const fallback = JsonSanitizer.tryFallbackParsing(cleaned) as Record<string, unknown>;
      if (!fallback.title || !Array.isArray(fallback.questions)) {
        throw new Error('Fallback parse also missing title or questions');
      }
      return fallback as unknown as GeminiQuizResponse;
    } catch {
      throw new Error(`Failed to parse quiz JSON from OpenRouter: ${err}`);
    }
  }
}

/**
 * Parse an OpenRouter flashcard JSON response.
 */
function parseFlashcardsJson(raw: string): FlashcardItem[] {
  const text = stripCodeFences(raw);
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as FlashcardItem[];
    throw new Error('Parsed value is not an array');
  } catch {
    // Extract first JSON array
    const arrayMatch = text.match(/(\[[\s\S]*\])/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[1]);
        if (Array.isArray(parsed)) return parsed as FlashcardItem[];
      } catch {
        // fall through
      }
    }
    const sanitized = JsonSanitizer.initialCleanup(text);
    const sanitizedMatch = sanitized.match(/(\[[\s\S]*\])/);
    if (sanitizedMatch) {
      const parsed = JSON.parse(sanitizedMatch[1]);
      if (Array.isArray(parsed)) return parsed as FlashcardItem[];
    }
    throw new Error('Could not extract a valid JSON array from OpenRouter flashcard response');
  }
}

/**
 * Orchestrates LLM provider selection and generation for the three Phase-2
 * capabilities: quiz, flashcards, and documentFromPrompt.
 *
 * For any capability, the Gemini path calls GeminiService directly (unchanged
 * behaviour). The OpenRouter path builds the same prompt strings and sends
 * them to OpenRouter's chat-completions endpoint.
 *
 * All error paths fall back to Gemini via LlmRouteResolver — no generation
 * endpoint should ever see a 500 just because routing failed.
 */
export class LlmGenerationService {
  static async generateQuiz(
    content: ScrapedContent,
    additionalPrompt?: string,
    capability: LlmCapability = 'quiz'
  ): Promise<GeminiQuizResponse> {
    const { route, openRouterApiKey } = await LlmRouteResolver.resolve(capability);

    functions.logger.info('LLM route resolved for quiz', {
      providerType: route.providerType,
      model: route.model,
      fallbackUsed: route.fallbackUsed,
    });

    if (route.providerType === 'gemini') {
      return GeminiService.generateQuiz(content, additionalPrompt);
    }

    // OpenRouter path
    const randomAnswers = QuizPromptBuilder.generateRandomCorrectAnswers(30);
    const prompt = QuizPromptBuilder.buildQuizPrompt(content, additionalPrompt, randomAnswers);

    const client = LlmProviderClientFactory.create(route, openRouterApiKey);
    const result = await client.generateText({
      prompt,
      config: { model: route.model, temperature: 0.4, topK: 40, topP: 0.95, maxOutputTokens: 16384 },
    });

    functions.logger.info('Quiz generated via OpenRouter', {
      model: result.model,
      responseLength: result.text.length,
    });

    return parseQuizJson(result.text);
  }

  static async generateFlashcards(
    content: string,
    rules?: string,
    descriptionRules?: string,
    capability: LlmCapability = 'flashcards'
  ): Promise<FlashcardItem[]> {
    const { route, openRouterApiKey } = await LlmRouteResolver.resolve(capability);

    functions.logger.info('LLM route resolved for flashcards', {
      providerType: route.providerType,
      model: route.model,
      fallbackUsed: route.fallbackUsed,
    });

    if (route.providerType === 'gemini') {
      return GeminiService.generateFlashcards(content, rules, descriptionRules);
    }

    // OpenRouter path
    const prompt = FlashcardPromptBuilder.buildFlashcardPrompt(content, rules, descriptionRules);
    const client = LlmProviderClientFactory.create(route, openRouterApiKey);
    const result = await client.generateText({
      prompt,
      config: { model: route.model, temperature: 0.4, maxOutputTokens: 8192 },
    });

    functions.logger.info('Flashcards generated via OpenRouter', {
      model: result.model,
      responseLength: result.text.length,
    });

    const cards = parseFlashcardsJson(result.text);
    cards.forEach((card, idx) => {
      if (!card.front || !card.back) {
        throw new Error(`Invalid flashcard at index ${idx}: missing front or back`);
      }
    });
    return cards;
  }

  static async generateDocumentFromPrompt(
    userPrompt: string,
    files?: IFileContent[],
    rules?: string,
    capability: LlmCapability = 'documentFromPrompt'
  ): Promise<string> {
    const { route, openRouterApiKey } = await LlmRouteResolver.resolve(capability);

    functions.logger.info('LLM route resolved for documentFromPrompt', {
      providerType: route.providerType,
      model: route.model,
      fallbackUsed: route.fallbackUsed,
    });

    if (route.providerType === 'gemini') {
      return GeminiService.generateDocumentFromPrompt(userPrompt, files, rules);
    }

    // OpenRouter path
    if (files && files.length > 0) {
      validateContextFiles(files);
      functions.logger.info('Context files validated for OpenRouter', {
        filesCount: files.length,
        estimatedTokens: estimateContextTokens(files),
      });
    }

    const prompt =
      files && files.length > 0
        ? buildPromptWithContextFiles(userPrompt, files, rules)
        : DocumentPromptBuilder.buildDocumentPrompt(userPrompt, rules);

    const client = LlmProviderClientFactory.create(route, openRouterApiKey);
    const result = await client.generateText({
      prompt,
      config: { model: route.model, temperature: 0.7, topP: 0.95, maxOutputTokens: 16384 },
    });

    functions.logger.info('Document generated via OpenRouter', {
      model: result.model,
      responseLength: result.text.length,
    });

    // Strip any accidental code-fence wrapper the model may have added
    return stripCodeFences(result.text);
  }
}
