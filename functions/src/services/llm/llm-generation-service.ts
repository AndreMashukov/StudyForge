import * as functions from 'firebase-functions';
import type {
  ScrapedContent,
  IFileContent,
  QuizFollowupContext,
  DocumentQuestionContext,
  DirectoryChatPromptContext,
} from '@shared-types';
import {
  GeminiService,
  JsonSanitizer,
  type GeminiQuizResponse,
  type GeminiDiagramQuizResponse,
  type GeminiSequenceQuizResponse,
} from '../gemini';
import {
  QuizPromptBuilder,
  FlashcardPromptBuilder,
  DocumentPromptBuilder,
  FollowupPromptBuilder,
  DocumentQuestionPromptBuilder,
  DirectoryChatPromptBuilder,
  SlideDeckPromptBuilder,
  DiagramQuizPromptBuilder,
  SequenceQuizPromptBuilder,
  ScreenshotPromptBuilder,
} from '../gemini/prompt-builder';
import { RulePromptBuilder } from '../gemini/prompt-builder/rule-prompt-builder';
import { parseRuleResponse, type RuleGenerationResponse } from '../gemini/rule-response-parser';
import {
  buildPromptWithContextFiles,
  validateContextFiles,
  estimateContextTokens,
} from '../gemini/prompt-builder/withContextFiles';
import { LlmImageRouteResolver } from './llm-image-route-resolver';
import { LlmProviderClientFactory } from './llm-provider-client-factory';
import { LlmVisionRouteResolver } from './llm-vision-route-resolver';
import { generateOpenRouterText, resolveTextRoute } from './llm-text-runner';
import { normalizeScreenshotImage } from './screenshot-image-utils';
import { parseSlideDeckOutlineJson } from './llm-slide-outline-parser';
import type { LlmCapability } from './types';

type FlashcardItem = { front: string; back: string; description?: string };

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

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

function parseFlashcardsJson(raw: string): FlashcardItem[] {
  const text = stripCodeFences(raw);
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as FlashcardItem[];
    throw new Error('Parsed value is not an array');
  } catch {
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
 * Central orchestration for LLM provider selection and generation.
 * Text capabilities may route to OpenRouter; image/multimodal flows use configured Gemini image models.
 */
export class LlmGenerationService {
  static async generateQuiz(
    content: ScrapedContent,
    additionalPrompt?: string,
    capability: LlmCapability = 'quiz'
  ): Promise<GeminiQuizResponse> {
    const ctx = await resolveTextRoute(capability, 'quiz');
    if (!ctx.usesOpenRouter) {
      return GeminiService.generateQuiz(content, additionalPrompt);
    }

    const randomAnswers = QuizPromptBuilder.generateRandomCorrectAnswers(30);
    const prompt = QuizPromptBuilder.buildQuizPrompt(content, additionalPrompt, randomAnswers);
    const text = await generateOpenRouterText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.4, topK: 40, topP: 0.95, maxOutputTokens: 16384 },
      'Quiz generated via OpenRouter'
    );
    return parseQuizJson(text);
  }

  static async generateDiagramQuiz(
    content: ScrapedContent,
    additionalPrompt?: string
  ): Promise<GeminiDiagramQuizResponse> {
    const ctx = await resolveTextRoute('diagramQuiz', 'diagramQuiz');
    if (!ctx.usesOpenRouter) {
      return GeminiService.generateDiagramQuiz(content, additionalPrompt);
    }

    const randomCorrectAnswers = DiagramQuizPromptBuilder.generateRandomCorrectAnswers(20);
    const prompt = DiagramQuizPromptBuilder.buildDiagramQuizPrompt(
      content,
      additionalPrompt,
      randomCorrectAnswers
    );
    const text = await generateOpenRouterText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.4, topK: 40, topP: 0.95, maxOutputTokens: 16384 },
      'Diagram quiz generated via OpenRouter'
    );
    return GeminiService.parseDiagramQuizResponseFromText(text);
  }

  static async generateSequenceQuiz(
    content: ScrapedContent,
    additionalPrompt?: string
  ): Promise<GeminiSequenceQuizResponse> {
    const ctx = await resolveTextRoute('sequenceQuiz', 'sequenceQuiz');
    if (!ctx.usesOpenRouter) {
      return GeminiService.generateSequenceQuiz(content, additionalPrompt);
    }

    const prompt = SequenceQuizPromptBuilder.buildSequenceQuizPrompt(content, additionalPrompt);
    const text = await generateOpenRouterText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.4, topK: 40, topP: 0.95, maxOutputTokens: 16384 },
      'Sequence quiz generated via OpenRouter'
    );
    return GeminiService.parseSequenceQuizResponseFromText(text);
  }

  static async generateFlashcards(
    content: string,
    rules?: string,
    descriptionRules?: string,
    capability: LlmCapability = 'flashcards'
  ): Promise<FlashcardItem[]> {
    const ctx = await resolveTextRoute(capability, 'flashcards');
    if (!ctx.usesOpenRouter) {
      return GeminiService.generateFlashcards(content, rules, descriptionRules);
    }

    const prompt = FlashcardPromptBuilder.buildFlashcardPrompt(content, rules, descriptionRules);
    const text = await generateOpenRouterText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.4, maxOutputTokens: 8192 },
      'Flashcards generated via OpenRouter'
    );

    const cards = parseFlashcardsJson(text);
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
    const ctx = await resolveTextRoute(capability, 'documentFromPrompt');
    if (!ctx.usesOpenRouter) {
      return GeminiService.generateDocumentFromPrompt(userPrompt, files, rules);
    }

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

    const text = await generateOpenRouterText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.7, topP: 0.95, maxOutputTokens: 16384 },
      'Document generated via OpenRouter'
    );

    return GeminiService.sanitizeDocumentResponse(stripCodeFences(text));
  }

  static async generateDocumentFromScreenshot(
    imageBase64: string,
    userPrompt?: string,
    rules?: string
  ): Promise<string> {
    const visionResolution = await LlmVisionRouteResolver.resolve('documentFromScreenshot');
    const { route, openRouterApiKey } = visionResolution;

    if (route.providerType === 'openrouter' && openRouterApiKey) {
      try {
        const normalized = normalizeScreenshotImage(imageBase64);
        const prompt = ScreenshotPromptBuilder.buildDocumentPrompt({
          userPrompt,
          rules,
        });
        const client = LlmProviderClientFactory.create(route, openRouterApiKey);
        const result = await client.generateVisionText({
          prompt,
          imageDataUrl: normalized.dataUrl,
          config: {
            model: route.model,
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 16384,
          },
          detail: 'auto',
        });

        functions.logger.info('Screenshot document generated via OpenRouter vision', {
          model: result.model,
          responseLength: result.text.length,
        });

        return GeminiService.sanitizeDocumentResponse(stripCodeFences(result.text));
      } catch (error) {
        functions.logger.warn('OpenRouter vision failed; falling back to Gemini', {
          model: route.model,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return GeminiService.generateDocumentFromScreenshot(imageBase64, userPrompt, rules);
  }

  static async generateQuizFollowup(context: QuizFollowupContext): Promise<string> {
    const ctx = await resolveTextRoute('quizFollowup', 'quizFollowup');
    if (!ctx.usesOpenRouter) {
      return GeminiService.generateQuizFollowup(context);
    }

    const prompt = FollowupPromptBuilder.buildFollowupPrompt(context);
    const text = await generateOpenRouterText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
      'Quiz followup generated via OpenRouter'
    );
    return GeminiService.sanitizeMarkdownResponse(text);
  }

  static async generateDocumentQuestionAnswer(
    context: DocumentQuestionContext
  ): Promise<string> {
    const ctx = await resolveTextRoute('documentQuestion', 'documentQuestion');
    if (!ctx.usesOpenRouter) {
      return GeminiService.generateDocumentQuestionAnswer(context);
    }

    const prompt = DocumentQuestionPromptBuilder.buildPrompt(context);
    const text = await generateOpenRouterText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
      'Document question answer generated via OpenRouter'
    );
    return GeminiService.sanitizeMarkdownResponse(text);
  }

  static async generateDirectoryChatAnswer(
    context: DirectoryChatPromptContext
  ): Promise<string> {
    const ctx = await resolveTextRoute('directoryChat', 'directoryChat');
    if (!ctx.usesOpenRouter) {
      return GeminiService.generateDirectoryChatAnswer(context);
    }

    const prompt = DirectoryChatPromptBuilder.buildPrompt(context);
    const text = await generateOpenRouterText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
      'Directory chat answer generated via OpenRouter'
    );
    return GeminiService.sanitizeMarkdownResponse(text);
  }

  static async generateSlideDeckOutline(
    content: string,
    additionalPrompt?: string,
    rules?: string
  ): Promise<Array<{ title: string; content: string; speakerNotes?: string }>> {
    const ctx = await resolveTextRoute('slideDeckText', 'slideDeckText');
    if (!ctx.usesOpenRouter) {
      return GeminiService.generateSlideDeckOutline(content, additionalPrompt, rules);
    }

    const prompt = SlideDeckPromptBuilder.buildSlideOutlinePrompt(
      content,
      additionalPrompt,
      rules
    );
    const text = await generateOpenRouterText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 16384 },
      'Slide deck outline generated via OpenRouter'
    );
    return parseSlideDeckOutlineJson(text);
  }

  static async generateSlideImageBrief(
    slideTitle: string,
    slideContent: string,
    rules?: string
  ): Promise<string | null> {
    const ctx = await resolveTextRoute('slideDeckText', 'slideDeckImageBrief');
    if (!ctx.usesOpenRouter) {
      return GeminiService.generateSlideImageBrief(slideTitle, slideContent, rules);
    }

    const prompt = SlideDeckPromptBuilder.buildSlideImageBriefPrompt(
      slideTitle,
      slideContent,
      rules
    );
    try {
      const text = await generateOpenRouterText(
        ctx,
        prompt,
        { model: ctx.resolution.route.model, temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 4096 },
        'Slide image brief generated via OpenRouter'
      );
      return text.trim() || null;
    } catch (error) {
      functions.logger.warn('Slide image brief generation failed (non-fatal):', error);
      return null;
    }
  }

  static async generateSlideImage(
    slideTitle: string,
    slideContent: string,
    rules?: string
  ): Promise<string | null> {
    const imageResolution = await LlmImageRouteResolver.resolve('slideDeckImage');
    const prompt = SlideDeckPromptBuilder.buildSlideImagePrompt(
      slideTitle,
      slideContent,
      rules
    );
    return LlmGenerationService.generateSlideImageWithPrompt(prompt, imageResolution);
  }

  static async generateSlideImageFromPrompt(prompt: string): Promise<string | null> {
    const imageResolution = await LlmImageRouteResolver.resolve('slideDeckImage');
    return LlmGenerationService.generateSlideImageWithPrompt(prompt, imageResolution);
  }

  private static async generateSlideImageWithPrompt(
    prompt: string,
    imageResolution: Awaited<ReturnType<typeof LlmImageRouteResolver.resolve>>
  ): Promise<string | null> {
    const { route, openRouterApiKey, geminiImageModel } = imageResolution;

    if (route.providerType === 'openrouter' && openRouterApiKey) {
      try {
        const client = LlmProviderClientFactory.create(route, openRouterApiKey);
        const result = await client.generateImage({
          prompt,
          config: { model: route.model },
          imageConfig: { aspectRatio: '16:9' },
        });

        functions.logger.info('Slide image generated via OpenRouter', {
          model: result.model,
          imageBytes: result.imageBase64.length,
        });

        return result.imageBase64;
      } catch (error) {
        functions.logger.warn('OpenRouter image generation failed; falling back to Gemini', {
          model: route.model,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    functions.logger.info('Slide image generated via Gemini', {
      model: geminiImageModel,
    });

    return GeminiService.generateSlideImageFromPrompt(prompt, geminiImageModel);
  }

  static async enhanceExtractedDocument(
    markdownContent: string,
    sourceFilename: string,
    rules?: string
  ): Promise<string> {
    const ctx = await resolveTextRoute('sourceDocumentEnhancement', 'sourceDocumentEnhancement');
    if (!ctx.usesOpenRouter) {
      return GeminiService.enhanceExtractedDocument(markdownContent, sourceFilename, rules);
    }

    const rulesSection = rules?.trim()
      ? `\n\nDomain rules to respect while cleaning the extraction:\n---\n${rules}\n---`
      : '';

    const prompt = `Clean up this extracted document and return polished Markdown only.

Source filename: ${sourceFilename}

Instructions:
- Preserve all substantive content from the extraction.
- Remove repeated page numbers, headers, footers, and extraction artifacts.
- Repair obvious broken line wrapping, bullet lists, headings, and tables.
- Keep the document faithful to the source; do not invent new sections or facts.
- Keep image omission notes only if they help the reader understand missing context.
- Start with a clear H1 heading if one is missing.
- Do not wrap the response in a Markdown code block.${rulesSection}

Extracted Markdown:
---
${markdownContent}
---`;

    const text = await generateOpenRouterText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.2, topK: 40, topP: 0.95, maxOutputTokens: 16384 },
      'Extracted document enhanced via OpenRouter'
    );

    return GeminiService.sanitizeDocumentResponse(stripCodeFences(text));
  }

  static async generateRule(params: {
    topic: string;
    description?: string;
    applicableTo?: string[];
    existingContent?: string;
  }): Promise<RuleGenerationResponse> {
    const ctx = await resolveTextRoute('ruleGeneration', 'ruleGeneration');
    if (!ctx.usesOpenRouter) {
      return GeminiService.generateRule(params);
    }

    const prompt = params.existingContent
      ? RulePromptBuilder.buildImprovePrompt(
          params.existingContent,
          params.topic,
          params.description
        )
      : RulePromptBuilder.buildGeneratePrompt(
          params.topic,
          params.description,
          params.applicableTo
        );

    const text = await generateOpenRouterText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.5, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
      'Rule generated via OpenRouter'
    );

    return parseRuleResponse(text);
  }

  static async generateScrapedContentMarkdown(prompt: string): Promise<string> {
    const ctx = await resolveTextRoute('sourceDocumentEnhancement', 'scrapedContentMarkdown');
    if (!ctx.usesOpenRouter) {
      return GeminiService.generateContent(prompt);
    }

    const fullPrompt = QuizPromptBuilder.buildContentPrompt(prompt);
    const text = await generateOpenRouterText(
      ctx,
      fullPrompt,
      { model: ctx.resolution.route.model, temperature: 0.3, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
      'Scraped content markdown generated via OpenRouter'
    );
    return text.trim();
  }
}
