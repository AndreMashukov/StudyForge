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
  SubjectWorldPromptBuilder,
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
import {
  extractSlideImageBriefFromPrompt,
  fitMiniMaxImagePrompt,
  MINIMAX_SLIDE_BRIEF_MAX_CHARS,
  truncateAtWordBoundary,
} from './llm-image-prompt-utils';
import { LlmProviderClientFactory } from './llm-provider-client-factory';
import { LlmVisionRouteResolver } from './llm-vision-route-resolver';
import { generateExternalProviderText, resolveTextRoute } from './llm-text-runner';
import { normalizeScreenshotImage } from './screenshot-image-utils';
import { parseSlideDeckOutlineJson } from './llm-slide-outline-parser';
import type { LlmCapability } from './types';
import { generateDiagramQuizChunked } from '../diagram-quiz/diagram-quiz-chunked-generator';

type FlashcardItem = {
  front: string;
  back: string;
  description?: string;
  frontHtml?: string;
  backHtml?: string;
  descriptionHtml?: string;
};

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
    if (!ctx.usesExternalProvider) {
      return GeminiService.generateQuiz(content, additionalPrompt);
    }

    const randomAnswers = QuizPromptBuilder.generateRandomCorrectAnswers(30);
    const prompt = QuizPromptBuilder.buildQuizPrompt(content, additionalPrompt, randomAnswers);
    const text = await generateExternalProviderText(
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
    return generateDiagramQuizChunked(content, additionalPrompt);
  }

  /** @deprecated Use generateDiagramQuiz — routes to chunked generation for external providers. */
  static async generateDiagramQuizChunked(
    content: ScrapedContent,
    additionalPrompt?: string
  ): Promise<GeminiDiagramQuizResponse> {
    return generateDiagramQuizChunked(content, additionalPrompt);
  }

  static async generateSequenceQuiz(
    content: ScrapedContent,
    additionalPrompt?: string
  ): Promise<GeminiSequenceQuizResponse> {
    const ctx = await resolveTextRoute('sequenceQuiz', 'sequenceQuiz');
    if (!ctx.usesExternalProvider) {
      return GeminiService.generateSequenceQuiz(content, additionalPrompt);
    }

    const prompt = SequenceQuizPromptBuilder.buildSequenceQuizPrompt(content, additionalPrompt);
    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.4, topK: 40, topP: 0.95, maxOutputTokens: 16384 },
      'Sequence quiz generated via OpenRouter'
    );
    return GeminiService.parseSequenceQuizResponseFromText(text);
  }

  static async generateSubjectWorld(
    content: ScrapedContent,
    documentIds: string[],
    additionalPrompt?: string
  ): Promise<import('../gemini/gemini').GeminiSubjectWorldResponse> {
    const ctx = await resolveTextRoute('subjectWorld', 'subjectWorld');
    if (!ctx.usesExternalProvider) {
      return GeminiService.generateSubjectWorld(content, documentIds, additionalPrompt);
    }

    const prompt = SubjectWorldPromptBuilder.buildSubjectWorldPrompt(
      content,
      documentIds,
      additionalPrompt
    );
    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.5, topK: 40, topP: 0.95, maxOutputTokens: 16384 },
      'Subject world generated via OpenRouter'
    );
    return GeminiService.parseSubjectWorldResponseFromText(text);
  }

  static async generateFlashcards(
    content: string,
    rules?: string,
    descriptionRules?: string,
    capability: LlmCapability = 'flashcards'
  ): Promise<FlashcardItem[]> {
    const ctx = await resolveTextRoute(capability, 'flashcards');
    if (!ctx.usesExternalProvider) {
      return GeminiService.generateFlashcards(content, rules, descriptionRules);
    }

    const prompt = FlashcardPromptBuilder.buildFlashcardPrompt(content, rules, descriptionRules);
    const text = await generateExternalProviderText(
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
    if (!ctx.usesExternalProvider) {
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

    const text = await generateExternalProviderText(
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
    const { route, providerApiKey } = visionResolution;

    if (route.providerType !== 'gemini' && providerApiKey) {
      try {
        const normalized = normalizeScreenshotImage(imageBase64);
        const prompt = ScreenshotPromptBuilder.buildDocumentPrompt({
          userPrompt,
          rules,
        });
        const client = LlmProviderClientFactory.create(route, providerApiKey);
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

        functions.logger.info('Screenshot document generated via external provider vision', {
          model: result.model,
          responseLength: result.text.length,
        });

        return GeminiService.sanitizeDocumentResponse(stripCodeFences(result.text));
      } catch (error) {
        functions.logger.warn('External provider vision failed; falling back to Gemini', {
          model: route.model,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return GeminiService.generateDocumentFromScreenshot(imageBase64, userPrompt, rules);
  }

  static async generateQuizFollowup(context: QuizFollowupContext): Promise<string> {
    const ctx = await resolveTextRoute('quizFollowup', 'quizFollowup');
    if (!ctx.usesExternalProvider) {
      return GeminiService.generateQuizFollowup(context);
    }

    const prompt = FollowupPromptBuilder.buildFollowupPrompt(context);
    const text = await generateExternalProviderText(
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
    if (!ctx.usesExternalProvider) {
      return GeminiService.generateDocumentQuestionAnswer(context);
    }

    const prompt = DocumentQuestionPromptBuilder.buildPrompt(context);
    const text = await generateExternalProviderText(
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
    if (!ctx.usesExternalProvider) {
      return GeminiService.generateDirectoryChatAnswer(context);
    }

    const prompt = DirectoryChatPromptBuilder.buildPrompt(context);
    const text = await generateExternalProviderText(
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
    if (!ctx.usesExternalProvider) {
      return GeminiService.generateSlideDeckOutline(content, additionalPrompt, rules);
    }

    const prompt = SlideDeckPromptBuilder.buildSlideOutlinePrompt(
      content,
      additionalPrompt,
      rules
    );
    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 16384 },
      'Slide deck outline generated via external provider'
    );
    return parseSlideDeckOutlineJson(text);
  }

  static async generateSlideImageBrief(
    slideTitle: string,
    slideContent: string,
    rules?: string
  ): Promise<string | null> {
    const ctx = await resolveTextRoute('slideDeckText', 'slideDeckImageBrief');
    const imageResolution = await LlmImageRouteResolver.resolve('slideDeckImage');
    const usesMiniMaxImage =
      imageResolution.route.providerType === 'minimax' && !!imageResolution.providerApiKey;

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateSlideImageBrief(slideTitle, slideContent, rules);
    }

    const prompt = SlideDeckPromptBuilder.buildSlideImageBriefPrompt(
      slideTitle,
      slideContent,
      rules,
      usesMiniMaxImage ? { maxOutputChars: MINIMAX_SLIDE_BRIEF_MAX_CHARS } : undefined
    );
    try {
      const text = await generateExternalProviderText(
        ctx,
        prompt,
        { model: ctx.resolution.route.model, temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 4096 },
        'Slide image brief generated via external provider'
      );
      const brief = text.trim();
      if (!brief) {
        return null;
      }

      if (usesMiniMaxImage) {
        return truncateAtWordBoundary(brief, MINIMAX_SLIDE_BRIEF_MAX_CHARS);
      }

      return brief;
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
    const usesMiniMaxImage =
      imageResolution.route.providerType === 'minimax' && !!imageResolution.providerApiKey;
    const prompt = SlideDeckPromptBuilder.buildSlideImagePrompt(
      slideTitle,
      slideContent,
      rules,
      usesMiniMaxImage ? { compact: true } : undefined
    );
    return LlmGenerationService.generateSlideImageWithPrompt(prompt, imageResolution);
  }

  static async generateSlideImageFromPrompt(prompt: string): Promise<string | null> {
    const imageResolution = await LlmImageRouteResolver.resolve('slideDeckImage');
    return LlmGenerationService.generateSlideImageWithPrompt(prompt, imageResolution);
  }

  private static prepareMiniMaxSlideImagePrompt(prompt: string): string {
    const extractedBrief = extractSlideImageBriefFromPrompt(prompt);
    const compactPrompt = extractedBrief
      ? SlideDeckPromptBuilder.buildSlideImageFromBriefPrompt(
          truncateAtWordBoundary(extractedBrief, MINIMAX_SLIDE_BRIEF_MAX_CHARS),
          { compact: true }
        )
      : prompt;

    return fitMiniMaxImagePrompt(compactPrompt);
  }

  private static async generateSlideImageWithPrompt(
    prompt: string,
    imageResolution: Awaited<ReturnType<typeof LlmImageRouteResolver.resolve>>
  ): Promise<string | null> {
    const { route, providerApiKey, geminiImageModel } = imageResolution;

    if (route.providerType !== 'gemini' && providerApiKey) {
      try {
        const imagePrompt =
          route.providerType === 'minimax'
            ? LlmGenerationService.prepareMiniMaxSlideImagePrompt(prompt)
            : prompt;

        if (route.providerType === 'minimax' && imagePrompt.length !== prompt.length) {
          functions.logger.info('MiniMax slide image prompt trimmed', {
            originalLength: prompt.length,
            finalLength: imagePrompt.length,
          });
        }

        const client = LlmProviderClientFactory.create(route, providerApiKey);
        const result = await client.generateImage({
          prompt: imagePrompt,
          config: { model: route.model },
          imageConfig: { aspectRatio: '16:9' },
        });

        functions.logger.info('Slide image generated via external provider', {
          model: result.model,
          imageBytes: result.imageBase64.length,
        });

        return result.imageBase64;
      } catch (error) {
        functions.logger.warn('External provider image generation failed; falling back to Gemini', {
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
    if (!ctx.usesExternalProvider) {
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

    const text = await generateExternalProviderText(
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
    if (!ctx.usesExternalProvider) {
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

    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.5, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
      'Rule generated via OpenRouter'
    );

    return parseRuleResponse(text);
  }

  static async generateScrapedContentMarkdown(prompt: string): Promise<string> {
    const ctx = await resolveTextRoute('sourceDocumentEnhancement', 'scrapedContentMarkdown');
    if (!ctx.usesExternalProvider) {
      return GeminiService.generateContent(prompt);
    }

    const fullPrompt = QuizPromptBuilder.buildContentPrompt(prompt);
    const text = await generateExternalProviderText(
      ctx,
      fullPrompt,
      { model: ctx.resolution.route.model, temperature: 0.3, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
      'Scraped content markdown generated via OpenRouter'
    );
    return text.trim();
  }

  static async repairDiagramQuizDiagram(params: {
    sourceContent: ScrapedContent;
    questionText: string;
    brokenDiagram: string;
    parseError: string;
    syntaxRules: string;
  }): Promise<string> {
    const ctx = await resolveTextRoute('diagramQuizAgent', 'diagramQuizAgent');
    const prompt = `Fix this broken Mermaid diagram for a diagram quiz question.

Question: ${params.questionText}

Parse/validation error:
${params.parseError}

Broken diagram:
${params.brokenDiagram}

${params.syntaxRules}

Use the same neutral palette across all four options (never green/red answer hints). Keep emojis and non-semantic styling.

Return ONLY the corrected Mermaid source with no markdown fences or commentary.`;

    if (!ctx.usesExternalProvider) {
      const text = await GeminiService.generateContent(prompt);
      return stripCodeFences(text);
    }

    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.2, topK: 20, topP: 0.9, maxOutputTokens: 2048 },
      'Diagram quiz repair via OpenRouter'
    );
    return stripCodeFences(text);
  }

  static async runDiagramQuizCritic(params: {
    sourceContent: ScrapedContent;
    draft: GeminiDiagramQuizResponse;
    styleRules?: string;
  }): Promise<string> {
    const ctx = await resolveTextRoute('diagramQuizAgent', 'diagramQuizAgent');
    const styleSection = params.styleRules?.trim()
      ? `\nDiagram quiz styling rules (must be enforced):\n${params.styleRules}\n`
      : '';
    const prompt = `Review this diagram quiz against the source material.

Source title: ${params.sourceContent.title}

Source excerpt (truncated):
${params.sourceContent.content.slice(0, 12000)}
${styleSection}
Quiz JSON:
${JSON.stringify(params.draft)}

Return ONLY valid JSON with shape:
{
  "overallVerdict": "pass" | "revise" | "fail",
  "items": [
    { "itemIndex": 0, "severity": "ok" | "warning" | "blocker", "issues": ["..."] }
  ]
}

Pass when marked correct diagrams are supported by the source and distractors are plausible but wrong.
Flag as "revise" or "blocker" when diagrams use semantic green/red/blue answer hints or uneven styling that makes the correct option guessable (not when they share a neutral palette with emojis).
Use "revise" for fixable pedagogical issues and "fail" only for severe factual errors.`;

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateContent(prompt);
    }

    return generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, temperature: 0.2, topK: 20, topP: 0.9, maxOutputTokens: 4096 },
      'Diagram quiz critic via OpenRouter'
    );
  }

  static async refineDiagramQuiz(params: {
    sourceContent: ScrapedContent;
    draft: GeminiDiagramQuizResponse;
    criticResult: import('@shared-types').IArtifactCriticResult;
    failingQuestionIndexes: number[];
    enhancedPrompt?: string;
  }): Promise<GeminiDiagramQuizResponse> {
    const ctx = await resolveTextRoute('diagramQuiz', 'diagramQuiz');
    const failingQuestions = params.failingQuestionIndexes.map((index) => ({
      index,
      ...params.draft.questions[index],
    }));

    const prompt = `Refine ONLY the diagram quiz questions at indexes: ${params.failingQuestionIndexes.join(', ')}.

Source title: ${params.sourceContent.title}
Additional instructions: ${params.enhancedPrompt || '(none)'}

Critic feedback:
${JSON.stringify(params.criticResult)}

Failing questions (with indexes):
${JSON.stringify(failingQuestions)}

Full quiz for context (do not rewrite unchanged questions):
${JSON.stringify(params.draft)}

Return ONLY valid JSON with this shape:
{
  "questions": [
    {
      "index": 0,
      "question": "...",
      "diagrams": ["...", "...", "...", "..."],
      "correctAnswer": 0,
      "explanation": "...",
      "hint": "..."
    }
  ]
}

Include ONLY the listed indexes. Each diagram must be valid Mermaid source.`;

    const generationConfig = {
      temperature: 0.35,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    };

    if (!ctx.usesExternalProvider) {
      const text = await GeminiService.generateContent(prompt, generationConfig);
      return GeminiService.mergeDiagramQuizRefinement(
        params.draft,
        text,
        params.failingQuestionIndexes
      );
    }

    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, ...generationConfig },
      'Diagram quiz refine via OpenRouter'
    );
    return GeminiService.mergeDiagramQuizRefinement(
      params.draft,
      text,
      params.failingQuestionIndexes
    );
  }
}
