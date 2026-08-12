import * as functions from 'firebase-functions';
import type {
  LlmGenerationProfileId,
  ScrapedContent,
  IFileContent,
  IGenerationModelUsage,
  QuizFollowupContext,
  DocumentQuestionContext,
  DocumentReviseContext,
  DirectoryChatPromptContext,
} from '@shared-types';
import { resolveDocumentContentFormat } from '@shared-types';
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
  DocumentRevisePromptBuilder,
  DirectoryChatPromptBuilder,
  SlideDeckPromptBuilder,
  SequenceQuizPromptBuilder,
  ScreenshotPromptBuilder,
} from '../gemini/prompt-builder';
import { RulePromptBuilder } from '../gemini/prompt-builder/rule-prompt-builder';
import {
  parseRuleResponse,
  type RuleGenerationResponse,
} from '../gemini/rule-response-parser';
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
import {
  LlmGenerationRouteResolver,
  type GenerationRouteResolution,
} from './llm-generation-route-resolver';
import {
  formatGenerationModelLabel,
  toGenerationModelUsage,
} from './generation-model-usage';
import {
  generateExternalProviderText,
  resolveTextRoute,
  type TextRouteContext,
} from './llm-text-runner';
import { applyLlmGenerationDefaults } from './llm-generation-settings-repository';
import { resolveLlmGenerationProfile } from './llm-generation-profile-map';
import { normalizeScreenshotImage } from './screenshot-image-utils';
import { parseSlideDeckOutlineJson } from './llm-slide-outline-parser';
import type { IParsedFlashcardItem } from './flashcard-response-parser';
import type {
  LlmCapability,
  IGenerateTextOptions,
  LlmTextConfig,
} from './types';
import { generateFlashcardsChunked } from '@study-forge/backend-artifacts/flashcards/flashcard-chunked-generator';
import { generateDiagramQuizChunked } from '@study-forge/backend-artifacts/diagram-quiz/diagram-quiz-chunked-generator';
import { parseQuizJson } from './quiz-response-parser';

type FlashcardItem = IParsedFlashcardItem;

/**
 * Thinking models (Together MiniMax-M3) spend most of max_tokens on reasoning.
 * Diagram-quiz agent helpers previously used 2k–6k and truncated with empty content.
 */
const DIAGRAM_QUIZ_AGENT_MAX_OUTPUT_TOKENS = 32768;

function toGeminiContentOptions(config: LlmTextConfig): {
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  disableReasoning?: boolean;
  thinkingBudget?: number;
} {
  return {
    model: config.model,
    maxOutputTokens: config.maxOutputTokens,
    temperature: config.temperature,
    topK: config.topK,
    topP: config.topP,
    disableReasoning: config.disableReasoning,
    thinkingBudget: config.thinkingBudget,
  };
}

async function buildGenerationConfig(
  model: string,
  profile: LlmGenerationProfileId | undefined,
  overrides?: Partial<LlmTextConfig>,
): Promise<LlmTextConfig> {
  return applyLlmGenerationDefaults({ model, ...overrides }, { profile });
}

export interface GenerateFlashcardsResult {
  flashcards: FlashcardItem[];
  plannedTerms: string[];
  learnedTerms: string[];
  /** Route that actually ran generation — reuse for diagnostics/persistence. */
  generationModel: string;
  generationModelUsage: IGenerationModelUsage[];
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function parseClassificationConfidence(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, value));
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return Math.min(1, Math.max(0, parsed));
    }
  }
  return 0;
}

function parseClassificationIsLanguageLearning(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === 'True';
}

/** Close truncated JSON objects/strings that Gemini sometimes returns mid-object. */
function repairTruncatedJsonObject(raw: string): string {
  let text = raw.trim();
  if (!text.startsWith('{')) {
    return text;
  }

  let inString = false;
  let escape = false;
  let braceDepth = 0;
  for (const char of text) {
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\' && inString) {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '{') {
      braceDepth += 1;
    } else if (char === '}') {
      braceDepth -= 1;
    }
  }

  if (inString) {
    text += '"';
  }
  while (braceDepth > 0) {
    text += '}';
    braceDepth -= 1;
  }
  return text;
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const candidates = [
    stripCodeFences(raw),
    repairTruncatedJsonObject(stripCodeFences(raw)),
    JsonSanitizer.initialCleanup(raw),
    repairTruncatedJsonObject(JsonSanitizer.initialCleanup(raw)),
  ];

  let sanitized = JsonSanitizer.initialCleanup(raw);
  sanitized = JsonSanitizer.sanitizeJsonText(sanitized);
  sanitized = JsonSanitizer.applyComprehensiveCleanup(sanitized);
  sanitized = JsonSanitizer.applyStateBased(sanitized);
  candidates.push(sanitized, repairTruncatedJsonObject(sanitized));

  const relaxed = stripCodeFences(raw)
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null');
  const relaxedObject = relaxed.match(/(\{[\s\S]*\})/);
  if (relaxedObject) {
    candidates.push(relaxedObject[1]);
  }
  candidates.push(repairTruncatedJsonObject(relaxed));

  for (const candidate of candidates) {
    const objectMatch = candidate.match(/(\{[\s\S]*\})/);
    const text = objectMatch ? objectMatch[1] : candidate;
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next candidate
    }
  }

  try {
    const fallback = JsonSanitizer.tryFallbackParsing(sanitized);
    if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
      return fallback as Record<string, unknown>;
    }
  } catch {
    // fall through
  }

  return null;
}

function parseFlashcardLanguageClassification(
  raw: string,
): import('@shared-types').FlashcardLanguageClassification {
  const record = tryParseJsonObject(raw);
  if (!record) {
    functions.logger.error(
      'Could not parse flashcard language classification JSON',
      {
        responsePreview: raw.slice(0, 500),
        responseLength: raw.length,
      },
    );
    throw new Error('Could not parse flashcard language classification JSON');
  }

  const isLanguageLearning = parseClassificationIsLanguageLearning(
    record.isLanguageLearning,
  );
  const confidence = parseClassificationConfidence(record.confidence);
  const targetLanguageCode =
    typeof record.targetLanguageCode === 'string' &&
    record.targetLanguageCode.trim()
      ? record.targetLanguageCode.trim()
      : undefined;
  const targetLanguageName =
    typeof record.targetLanguageName === 'string' &&
    record.targetLanguageName.trim()
      ? record.targetLanguageName.trim()
      : undefined;

  if (!isLanguageLearning) {
    return { isLanguageLearning: false, confidence };
  }

  return {
    isLanguageLearning: true,
    confidence,
    ...(targetLanguageCode ? { targetLanguageCode } : {}),
    ...(targetLanguageName ? { targetLanguageName } : {}),
  };
}

/**
 * Central orchestration for LLM provider selection and generation.
 * Text capabilities may route to OpenRouter; image/multimodal flows use configured Gemini image models.
 */
export class LlmGenerationService {
  /**
   * Generic routed text generation for backend callers that already build prompts.
   */
  static async generateText(
    userId: string,
    capability: LlmCapability,
    prompt: string,
    options?: IGenerateTextOptions,
  ): Promise<string> {
    const logLabel = options?.logLabel ?? capability;
    const ctx = await resolveTextRoute(userId, capability, logLabel);

    const profile =
      options?.profile ?? resolveLlmGenerationProfile(capability);

    const generationConfig = await applyLlmGenerationDefaults(
      {
        model: ctx.resolution.route.model,
        requestTimeoutMs: options?.requestTimeoutMs,
        temperature: options?.temperature,
        topK: options?.topK,
        topP: options?.topP,
        maxOutputTokens: options?.maxOutputTokens,
        disableReasoning: options?.disableReasoning,
        thinkingBudget: options?.thinkingBudget,
      },
      { profile },
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateContent(
        prompt,
        toGeminiContentOptions(generationConfig),
      );
    }

    return generateExternalProviderText(
      ctx,
      prompt,
      generationConfig,
      options?.successLogMessage ??
        `Text generated via external provider (${logLabel})`,
    );
  }

  static async generateQuiz(
    userId: string,
    content: ScrapedContent,
    additionalPrompt?: string,
    capability: LlmCapability = 'quiz',
  ): Promise<GeminiQuizResponse> {
    const ctx = await resolveTextRoute(userId, capability, 'quiz');
    const profile = resolveLlmGenerationProfile(capability) ?? 'structuredArtifact';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateQuiz(
        content,
        additionalPrompt,
        toGeminiContentOptions(runtimeConfig),
      );
    }

    const randomAnswers = QuizPromptBuilder.generateRandomCorrectAnswers(30);
    const prompt = QuizPromptBuilder.buildQuizPrompt(
      content,
      additionalPrompt,
      randomAnswers,
    );
    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model },
      'Quiz generated via OpenRouter',
      { profile },
    );
    return parseQuizJson(text);
  }

  static async generateDiagramQuiz(
    userId: string,
    content: ScrapedContent,
    additionalPrompt?: string,
  ): Promise<GeminiDiagramQuizResponse> {
    return generateDiagramQuizChunked(userId, content, additionalPrompt);
  }

  /** @deprecated Use generateDiagramQuiz — routes to chunked generation for external providers. */
  static async generateDiagramQuizChunked(
    userId: string,
    content: ScrapedContent,
    additionalPrompt?: string,
  ): Promise<GeminiDiagramQuizResponse> {
    return generateDiagramQuizChunked(userId, content, additionalPrompt);
  }

  static async generateSequenceQuiz(
    userId: string,
    content: ScrapedContent,
    additionalPrompt?: string,
  ): Promise<GeminiSequenceQuizResponse> {
    const ctx = await resolveTextRoute(userId, 'sequenceQuiz', 'sequenceQuiz');
    const profile = resolveLlmGenerationProfile('sequenceQuiz') ?? 'structuredArtifact';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateSequenceQuiz(
        content,
        additionalPrompt,
        toGeminiContentOptions(runtimeConfig),
      );
    }

    const prompt = SequenceQuizPromptBuilder.buildSequenceQuizPrompt(
      content,
      additionalPrompt,
    );
    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model },
      'Sequence quiz generated via OpenRouter',
      { profile },
    );
    return GeminiService.parseSequenceQuizResponseFromText(text);
  }

  static async generateFlashcards(
    userId: string,
    content: string,
    rules?: string,
    descriptionRules?: string,
    capability: LlmCapability = 'flashcards',
    options?: import('../gemini/prompt-builder/flashcard-prompt-builder').FlashcardPromptOptions,
  ): Promise<GenerateFlashcardsResult> {
    const ctx = await resolveTextRoute(userId, capability, 'flashcards');
    const generationModel = formatGenerationModelLabel(ctx.resolution.route);
    const generationModelUsage = [toGenerationModelUsage(ctx.resolution)];

    const {
      flashcards: cards,
      plannedTerms,
      learnedTerms,
    } = await generateFlashcardsChunked(userId, {
      content,
      rules,
      descriptionRules,
      options,
    });

    functions.logger.info('Flashcards generated via chunked pipeline', {
      cardCount: cards.length,
      plannedTerms: plannedTerms.length,
      learnedExcludeCount: learnedTerms.length,
      providerType: ctx.resolution.route.providerType,
      model: ctx.resolution.route.model,
    });

    cards.forEach((card, idx) => {
      if (!card.front || !card.back) {
        throw new Error(
          `Invalid flashcard at index ${idx}: missing front or back`,
        );
      }
      if (options?.isLanguageLearning && !card.term?.trim()) {
        throw new Error(`Invalid flashcard at index ${idx}: missing term`);
      }
    });

    return {
      flashcards: cards,
      plannedTerms,
      learnedTerms,
      generationModel,
      generationModelUsage,
    };
  }

  static async classifyFlashcardLanguageLearning(
    userId: string,
    content: string,
    capability: LlmCapability = 'flashcards',
  ): Promise<import('@shared-types').FlashcardLanguageClassification> {
    const ctx = await resolveTextRoute(
      userId,
      capability,
      'flashcard-language-classification',
    );
    const prompt =
      FlashcardPromptBuilder.buildLanguageClassificationPrompt(content);
    const client = LlmProviderClientFactory.create(
      ctx.resolution.route,
      ctx.resolution.providerApiKey,
    );
    const result = await client.generateText({
      prompt,
      config: {
        model: ctx.resolution.route.model,
        temperature: 0.1,
        // Classification is a tiny JSON object — disable reasoning/thinking.
        maxOutputTokens: 1024,
        disableReasoning: true,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            isLanguageLearning: { type: 'boolean' },
            confidence: { type: 'number' },
            targetLanguageCode: { type: 'string', nullable: true },
            targetLanguageName: { type: 'string', nullable: true },
          },
          required: ['isLanguageLearning', 'confidence'],
        },
      },
    });

    functions.logger.info('Flashcard language classification completed', {
      userId,
      model: result.model,
      responseLength: result.text.length,
      responsePreview: result.text.slice(0, 200),
    });

    return parseFlashcardLanguageClassification(result.text);
  }

  static async generateDocumentFromPrompt(
    userId: string,
    userPrompt: string,
    files?: IFileContent[],
    rules?: string,
    capability: LlmCapability = 'documentFromPrompt',
  ): Promise<string> {
    const ctx = await resolveTextRoute(
      userId,
      capability,
      'documentFromPrompt',
    );
    const profile = resolveLlmGenerationProfile(capability) ?? 'longformContent';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateDocumentFromPrompt(
        userPrompt,
        files,
        rules,
        toGeminiContentOptions(runtimeConfig),
      );
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
      { model: ctx.resolution.route.model },
      'Document generated via OpenRouter',
      { profile },
    );

    return GeminiService.sanitizeDocumentResponse(stripCodeFences(text));
  }

  static async generateDocumentFromScreenshot(
    userId: string,
    imageBase64: string,
    userPrompt?: string,
    rules?: string,
  ): Promise<string> {
    const visionResolution = await LlmGenerationRouteResolver.resolve(
      'documentFromScreenshot',
      {
        userId,
      },
    );
    const { route, providerApiKey } = visionResolution;
    const profile =
      resolveLlmGenerationProfile('documentFromScreenshot') ??
      'longformContent';
    const config = await buildGenerationConfig(route.model, profile, {
      maxOutputTokens: 32768,
    });

    if (route.providerType === 'gemini') {
      return GeminiService.generateDocumentFromScreenshot(
        imageBase64,
        userPrompt,
        rules,
        toGeminiContentOptions(config),
      );
    }

    if (!providerApiKey) {
      throw new Error(
        'Vision provider API key is required for external providers',
      );
    }

    const normalized = normalizeScreenshotImage(imageBase64);
    const prompt = ScreenshotPromptBuilder.buildDocumentPrompt({
      userPrompt,
      rules,
    });
    const client = LlmProviderClientFactory.create(route, providerApiKey);
    const result = await client.generateVisionText({
      prompt,
      imageDataUrl: normalized.dataUrl,
      config,
      detail: 'auto',
    });

    functions.logger.info(
      'Screenshot document generated via external provider vision',
      {
        model: result.model,
        responseLength: result.text.length,
      },
    );

    return GeminiService.sanitizeDocumentResponse(stripCodeFences(result.text));
  }

  static async generateVisionHtmlFragment(
    userId: string,
    capability: 'documentFromScreenshot',
    imageBase64: string,
    prompt: string,
  ): Promise<string> {
    const visionResolution = await LlmGenerationRouteResolver.resolve(
      capability,
      {
        userId,
      },
    );
    const { route, providerApiKey } = visionResolution;
    const profile =
      resolveLlmGenerationProfile('documentFromScreenshot') ??
      'longformContent';
    const config = await buildGenerationConfig(route.model, profile, {
      maxOutputTokens: 32768,
    });

    if (route.providerType === 'gemini') {
      return GeminiService.generateVisionHtmlFragment(
        imageBase64,
        prompt,
        route.model,
        toGeminiContentOptions(config),
      );
    }

    if (!providerApiKey) {
      throw new Error(
        'Vision provider API key is required for external providers',
      );
    }

    const normalized = normalizeScreenshotImage(imageBase64);
    const client = LlmProviderClientFactory.create(route, providerApiKey);
    const result = await client.generateVisionText({
      prompt,
      imageDataUrl: normalized.dataUrl,
      config,
      detail: 'auto',
    });

    functions.logger.info(
      'Vision HTML fragment generated via external provider',
      {
        model: result.model,
        responseLength: result.text.length,
      },
    );

    return stripCodeFences(result.text);
  }

  static async generateQuizFollowup(
    userId: string,
    context: QuizFollowupContext,
  ): Promise<string> {
    const ctx = await resolveTextRoute(userId, 'quizFollowup', 'quizFollowup');
    const profile =
      resolveLlmGenerationProfile('quizFollowup') ?? 'explanatoryChat';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateQuizFollowup(
        context,
        toGeminiContentOptions(runtimeConfig),
      );
    }

    const prompt = FollowupPromptBuilder.buildFollowupPrompt(context);
    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model },
      'Quiz followup generated via OpenRouter',
      { profile },
    );
    return GeminiService.sanitizeMarkdownResponse(text);
  }

  static async generateDocumentQuestionAnswer(
    userId: string,
    context: DocumentQuestionContext,
  ): Promise<string> {
    const ctx = await resolveTextRoute(
      userId,
      'documentQuestion',
      'documentQuestion',
    );
    const profile =
      resolveLlmGenerationProfile('documentQuestion') ?? 'explanatoryChat';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateDocumentQuestionAnswer(
        context,
        toGeminiContentOptions(runtimeConfig),
      );
    }

    const prompt = DocumentQuestionPromptBuilder.buildPrompt(context);
    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model },
      'Document question answer generated via OpenRouter',
      { profile },
    );
    return GeminiService.sanitizeMarkdownResponse(text);
  }

  static async reviseDocument(
    userId: string,
    context: DocumentReviseContext,
  ): Promise<string> {
    const ctx = await resolveTextRoute(
      userId,
      'documentRevise',
      'documentRevise',
    );
    const profile =
      resolveLlmGenerationProfile('documentRevise') ?? 'faithfulEdit';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.reviseDocument(
        context,
        toGeminiContentOptions(runtimeConfig),
      );
    }

    const prompt = DocumentRevisePromptBuilder.buildPrompt(context);
    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model },
      'Document revision generated via OpenRouter',
      { profile },
    );
    return resolveDocumentContentFormat(context.contentFormat) === 'html'
      ? GeminiService.sanitizeHtmlRevisionResponse(text)
      : GeminiService.sanitizeDocumentResponse(text);
  }

  static async generateDirectoryChatAnswer(
    userId: string,
    context: DirectoryChatPromptContext,
  ): Promise<string> {
    const ctx = await resolveTextRoute(
      userId,
      'directoryChat',
      'directoryChat',
    );
    const profile =
      resolveLlmGenerationProfile('directoryChat') ?? 'explanatoryChat';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateDirectoryChatAnswer(
        context,
        toGeminiContentOptions(runtimeConfig),
      );
    }

    const prompt = DirectoryChatPromptBuilder.buildPrompt(context);
    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model },
      'Directory chat answer generated via OpenRouter',
      { profile },
    );
    return GeminiService.sanitizeMarkdownResponse(text);
  }

  static async generateSlideDeckOutline(
    userId: string,
    content: string,
    additionalPrompt?: string,
    rules?: string,
  ): Promise<Array<{ title: string; content: string; speakerNotes?: string }>> {
    const ctx = await resolveTextRoute(
      userId,
      'slideDeckText',
      'slideDeckText',
    );
    const profile =
      resolveLlmGenerationProfile('slideDeckText') ?? 'longformContent';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateSlideDeckOutline(
        content,
        additionalPrompt,
        rules,
        toGeminiContentOptions(runtimeConfig),
      );
    }

    const prompt = SlideDeckPromptBuilder.buildSlideOutlinePrompt(
      content,
      additionalPrompt,
      rules,
    );
    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model },
      'Slide deck outline generated via external provider',
      { profile },
    );
    return parseSlideDeckOutlineJson(text);
  }

  static async generateSlideImageBrief(
    userId: string,
    slideTitle: string,
    slideContent: string,
    rules?: string,
  ): Promise<string | null> {
    const ctx = await resolveTextRoute(
      userId,
      'slideDeckText',
      'slideDeckImageBrief',
    );
    const imageResolution = await LlmImageRouteResolver.resolve(
      'slideDeckImage',
      { userId },
    );
    const usesMiniMaxImage =
      imageResolution.route.providerType === 'minimax' &&
      !!imageResolution.providerApiKey;

    const profile =
      resolveLlmGenerationProfile('slideDeckText') ?? 'longformContent';
    const briefConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
      { maxOutputTokens: 4096 },
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateSlideImageBrief(
        slideTitle,
        slideContent,
        rules,
        toGeminiContentOptions(briefConfig),
      );
    }

    const prompt = SlideDeckPromptBuilder.buildSlideImageBriefPrompt(
      slideTitle,
      slideContent,
      rules,
      usesMiniMaxImage
        ? { maxOutputChars: MINIMAX_SLIDE_BRIEF_MAX_CHARS }
        : undefined,
    );
    try {
      const text = await generateExternalProviderText(
        ctx,
        prompt,
        { model: ctx.resolution.route.model, maxOutputTokens: 4096 },
        'Slide image brief generated via external provider',
        { profile },
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
      functions.logger.warn(
        'Slide image brief generation failed (non-fatal):',
        error,
      );
      return null;
    }
  }

  static async generateSlideImage(
    userId: string,
    slideTitle: string,
    slideContent: string,
    rules?: string,
  ): Promise<string | null> {
    const imageResolution = await LlmImageRouteResolver.resolve(
      'slideDeckImage',
      { userId },
    );
    const usesMiniMaxImage =
      imageResolution.route.providerType === 'minimax' &&
      !!imageResolution.providerApiKey;
    const prompt = SlideDeckPromptBuilder.buildSlideImagePrompt(
      slideTitle,
      slideContent,
      rules,
      usesMiniMaxImage ? { compact: true } : undefined,
    );
    return LlmGenerationService.generateSlideImageWithPrompt(
      prompt,
      imageResolution,
    );
  }

  static async generateSlideImageFromPrompt(
    userId: string,
    prompt: string,
  ): Promise<string | null> {
    const imageResolution = await LlmImageRouteResolver.resolve(
      'slideDeckImage',
      { userId },
    );
    return LlmGenerationService.generateSlideImageWithPrompt(
      prompt,
      imageResolution,
    );
  }

  private static prepareMiniMaxSlideImagePrompt(prompt: string): string {
    const extractedBrief = extractSlideImageBriefFromPrompt(prompt);
    const compactPrompt = extractedBrief
      ? SlideDeckPromptBuilder.buildSlideImageFromBriefPrompt(
          truncateAtWordBoundary(extractedBrief, MINIMAX_SLIDE_BRIEF_MAX_CHARS),
          { compact: true },
        )
      : prompt;

    return fitMiniMaxImagePrompt(compactPrompt);
  }

  private static async generateSlideImageWithPrompt(
    prompt: string,
    imageResolution: Awaited<ReturnType<typeof LlmImageRouteResolver.resolve>>,
  ): Promise<string | null> {
    const { route, providerApiKey, geminiImageModel } = imageResolution;
    const config = await applyLlmGenerationDefaults({ model: route.model });

    if (route.providerType !== 'gemini' && providerApiKey) {
      const imagePrompt =
        route.providerType === 'minimax'
          ? LlmGenerationService.prepareMiniMaxSlideImagePrompt(prompt)
          : prompt;

      if (
        route.providerType === 'minimax' &&
        imagePrompt.length !== prompt.length
      ) {
        functions.logger.info('MiniMax slide image prompt trimmed', {
          originalLength: prompt.length,
          finalLength: imagePrompt.length,
        });
      }

      const client = LlmProviderClientFactory.create(route, providerApiKey);
      const result = await client.generateImage({
        prompt: imagePrompt,
        config,
        imageConfig: { aspectRatio: '16:9' },
      });

      functions.logger.info('Slide image generated via external provider', {
        model: result.model,
        imageBytes: result.imageBase64.length,
      });

      return result.imageBase64;
    }

    functions.logger.info('Slide image generated via Gemini', {
      model: geminiImageModel,
    });

    return GeminiService.generateSlideImageFromPrompt(
      prompt,
      geminiImageModel,
      toGeminiContentOptions(config),
    );
  }

  static async enhanceExtractedDocument(
    userId: string,
    markdownContent: string,
    sourceFilename: string,
    rules?: string,
  ): Promise<string> {
    const ctx = await resolveTextRoute(
      userId,
      'sourceDocumentEnhancement',
      'sourceDocumentEnhancement',
    );
    const profile =
      resolveLlmGenerationProfile('sourceDocumentEnhancement') ??
      'deterministicUtility';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
      { maxOutputTokens: 16384 },
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.enhanceExtractedDocument(
        markdownContent,
        sourceFilename,
        rules,
        toGeminiContentOptions(runtimeConfig),
      );
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
      { model: ctx.resolution.route.model, maxOutputTokens: 16384 },
      'Extracted document enhanced via OpenRouter',
      { profile },
    );

    return GeminiService.sanitizeDocumentResponse(stripCodeFences(text));
  }

  static async generateRule(
    userId: string,
    params: {
      topic: string;
      description?: string;
      applicableTo?: string[];
      existingContent?: string;
    },
  ): Promise<RuleGenerationResponse> {
    const ctx = await resolveTextRoute(
      userId,
      'ruleGeneration',
      'ruleGeneration',
    );
    const profile =
      resolveLlmGenerationProfile('ruleGeneration') ?? 'faithfulEdit';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
      { maxOutputTokens: 8192 },
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateRule(
        params,
        toGeminiContentOptions(runtimeConfig),
      );
    }

    const prompt = params.existingContent
      ? RulePromptBuilder.buildImprovePrompt(
          params.existingContent,
          params.topic,
          params.description,
        )
      : RulePromptBuilder.buildGeneratePrompt(
          params.topic,
          params.description,
          params.applicableTo,
        );

    const text = await generateExternalProviderText(
      ctx,
      prompt,
      { model: ctx.resolution.route.model, maxOutputTokens: 8192 },
      'Rule generated via OpenRouter',
      { profile },
    );

    return parseRuleResponse(text);
  }

  static async generateScrapedContentMarkdown(
    userId: string,
    prompt: string,
  ): Promise<string> {
    const ctx = await resolveTextRoute(
      userId,
      'sourceDocumentEnhancement',
      'scrapedContentMarkdown',
    );
    const profile =
      resolveLlmGenerationProfile('sourceDocumentEnhancement') ??
      'deterministicUtility';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
      { temperature: 0.3 },
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateContent(
        prompt,
        toGeminiContentOptions(runtimeConfig),
      );
    }

    const fullPrompt = QuizPromptBuilder.buildContentPrompt(prompt);
    const text = await generateExternalProviderText(
      ctx,
      fullPrompt,
      { model: ctx.resolution.route.model, temperature: 0.3 },
      'Scraped content markdown generated via OpenRouter',
      { profile },
    );
    return text.trim();
  }

  static async repairDiagramQuizDiagram(
    userId: string,
    params: {
      sourceContent: ScrapedContent;
      questionText: string;
      brokenDiagram: string;
      parseError: string;
      syntaxRules: string;
    },
  ): Promise<string> {
    const ctx = await resolveTextRoute(
      userId,
      'diagramQuizAgent',
      'diagramQuizAgent',
    );
    const prompt = `Fix this broken Mermaid diagram for a diagram quiz question.

Question: ${params.questionText}

Parse/validation error:
${params.parseError}

Broken diagram:
${params.brokenDiagram}

${params.syntaxRules}

Use the same neutral palette across all four options (never green/red answer hints). Keep emojis and non-semantic styling.

Return ONLY the corrected Mermaid source with no markdown fences or commentary.`;

    const profile =
      resolveLlmGenerationProfile('diagramQuizAgent') ?? 'deterministicUtility';
    const repairConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
      {
        maxOutputTokens: DIAGRAM_QUIZ_AGENT_MAX_OUTPUT_TOKENS,
        topK: 20,
        topP: 0.9,
      },
    );

    if (!ctx.usesExternalProvider) {
      const text = await GeminiService.generateContent(
        prompt,
        toGeminiContentOptions(repairConfig),
      );
      return stripCodeFences(text);
    }

    const text = await generateExternalProviderText(
      ctx,
      prompt,
      {
        model: ctx.resolution.route.model,
        maxOutputTokens: DIAGRAM_QUIZ_AGENT_MAX_OUTPUT_TOKENS,
        topK: 20,
        topP: 0.9,
      },
      'Diagram quiz repair via OpenRouter',
      { profile },
    );
    return stripCodeFences(text);
  }

  /**
   * Rewrite all four option diagrams for one question so they share the same
   * visual scaffold. Used when the visualComplexity gate detects an answer leak.
   */
  static async rebalanceDiagramQuizQuestion(
    userId: string,
    params: {
      sourceContent: ScrapedContent;
      questionText: string;
      correctAnswer: number;
      explanation: string;
      diagrams: [string, string, string, string];
      validationError: string;
      syntaxRules: string;
    },
  ): Promise<[string, string, string, string]> {
    const ctx = await resolveTextRoute(
      userId,
      'diagramQuizAgent',
      'diagramQuizAgent',
    );
    const optionLabels = ['A', 'B', 'C', 'D'] as const;
    const currentOptions = params.diagrams
      .map((diagram, index) => {
        const marker =
          index === params.correctAnswer ? ' (CORRECT ANSWER)' : ' (distractor)';
        return `Option ${optionLabels[index]} index ${index}${marker}:\n${diagram}`;
      })
      .join('\n\n');

    const prompt = `Rebalance all four Mermaid answer diagrams for one diagram-quiz question.

Validation error:
${params.validationError}

Question: ${params.questionText}
Correct answer index: ${params.correctAnswer}
Explanation summary: ${params.explanation}

Source title: ${params.sourceContent.title}
Source excerpt (truncated):
${params.sourceContent.content.slice(0, 8000)}

Current diagrams:
${currentOptions}

${params.syntaxRules}

Requirements:
- Return exactly 4 Mermaid diagrams that keep the same factual correct answer at index ${params.correctAnswer}.
- All four must use the same diagram type and the same visual scaffold (same node/participant count, same subgraph count, similar edge count).
- Structural line counts must stay within about 1-2 lines of each other. Do not make the correct option uniquely longer or denser.
- Create wrong options by changing direction, labels, routing targets, or relationships inside that shared scaffold — not by deleting major nodes or omitting whole branches.
- Keep a shared neutral palette. Never use semantic green/red/blue to mark the answer.
- For sequenceDiagram, do not emit style/classDef lines.

Return ONLY valid JSON:
{
  "diagrams": ["...", "...", "...", "..."]
}`;

    const profile =
      resolveLlmGenerationProfile('diagramQuizAgent') ?? 'deterministicUtility';
    const repairConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
      {
        maxOutputTokens: DIAGRAM_QUIZ_AGENT_MAX_OUTPUT_TOKENS,
        topK: 20,
        topP: 0.9,
        temperature: 0.25,
      },
    );

    const raw = !ctx.usesExternalProvider
      ? await GeminiService.generateContent(
          prompt,
          toGeminiContentOptions(repairConfig),
        )
      : await generateExternalProviderText(
          ctx,
          prompt,
          {
            model: ctx.resolution.route.model,
            maxOutputTokens: DIAGRAM_QUIZ_AGENT_MAX_OUTPUT_TOKENS,
            topK: 20,
            topP: 0.9,
            temperature: 0.25,
          },
          'Diagram quiz visual-complexity rebalance via OpenRouter',
          { profile },
        );

    let cleaned = JsonSanitizer.initialCleanup(raw);
    cleaned = JsonSanitizer.sanitizeJsonText(cleaned);
    cleaned = JsonSanitizer.applyComprehensiveCleanup(cleaned);
    cleaned = JsonSanitizer.applyStateBased(cleaned);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (error) {
      JsonSanitizer.logParsingError(error, raw, cleaned);
      parsed = JsonSanitizer.tryFallbackParsing(cleaned);
    }

    const diagramsValue =
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'diagrams' in parsed
        ? (parsed as { diagrams: unknown }).diagrams
        : null;

    if (!Array.isArray(diagramsValue) || diagramsValue.length !== 4) {
      throw new Error('Diagram quiz rebalance did not return exactly 4 diagrams');
    }

    const diagrams = diagramsValue.map((diagram, index) => {
      if (typeof diagram !== 'string' || !diagram.trim()) {
        throw new Error(`Diagram quiz rebalance returned empty diagram at index ${index}`);
      }
      return diagram.trim();
    });

    return [diagrams[0], diagrams[1], diagrams[2], diagrams[3]];
  }

  static async runDiagramQuizCritic(
    userId: string,
    params: {
      sourceContent: ScrapedContent;
      draft: GeminiDiagramQuizResponse;
      styleRules?: string;
    },
  ): Promise<string> {
    const ctx = await resolveTextRoute(
      userId,
      'diagramQuizAgent',
      'diagramQuizAgent',
    );
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
Flag as "revise" when one option is uniquely more detailed/complex than the others, or when any option has invalid Mermaid syntax — broken distractors are not acceptable.
Use "revise" for fixable pedagogical issues and "fail" only for severe factual errors.`;

    const profile =
      resolveLlmGenerationProfile('diagramQuizAgent') ?? 'deterministicUtility';
    const criticConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
      {
        maxOutputTokens: DIAGRAM_QUIZ_AGENT_MAX_OUTPUT_TOKENS,
        topK: 20,
        topP: 0.9,
      },
    );

    if (!ctx.usesExternalProvider) {
      return GeminiService.generateContent(
        prompt,
        toGeminiContentOptions(criticConfig),
      );
    }

    return generateExternalProviderText(
      ctx,
      prompt,
      {
        model: ctx.resolution.route.model,
        maxOutputTokens: DIAGRAM_QUIZ_AGENT_MAX_OUTPUT_TOKENS,
        topK: 20,
        topP: 0.9,
      },
      'Diagram quiz critic via OpenRouter',
      { profile },
    );
  }

  static async refineDiagramQuiz(
    userId: string,
    params: {
      sourceContent: ScrapedContent;
      draft: GeminiDiagramQuizResponse;
      criticResult: import('@shared-types').IArtifactCriticResult;
      failingQuestionIndexes: number[];
      enhancedPrompt?: string;
    },
  ): Promise<GeminiDiagramQuizResponse> {
    const ctx = await resolveTextRoute(userId, 'diagramQuiz', 'diagramQuiz');
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

    const profile = 'deterministicUtility';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
      {
        temperature: 0.35,
        maxOutputTokens: DIAGRAM_QUIZ_AGENT_MAX_OUTPUT_TOKENS,
      },
    );

    if (!ctx.usesExternalProvider) {
      const text = await GeminiService.generateContent(
        prompt,
        toGeminiContentOptions(runtimeConfig),
      );
      return GeminiService.mergeDiagramQuizRefinement(
        params.draft,
        text,
        params.failingQuestionIndexes,
      );
    }

    const text = await generateExternalProviderText(
      ctx,
      prompt,
      {
        model: ctx.resolution.route.model,
        temperature: 0.35,
        maxOutputTokens: DIAGRAM_QUIZ_AGENT_MAX_OUTPUT_TOKENS,
      },
      'Diagram quiz refine via OpenRouter',
      { profile },
    );
    return GeminiService.mergeDiagramQuizRefinement(
      params.draft,
      text,
      params.failingQuestionIndexes,
    );
  }

  static async evaluateScreenshotRuleCompliance(
    routeResolution: GenerationRouteResolution,
    draft: string,
    userPrompt?: string,
    rulesText?: string,
  ): Promise<{ passed: boolean; summary?: string }> {
    const ctx: TextRouteContext = {
      resolution: routeResolution,
      usesExternalProvider: routeResolution.route.providerType !== 'gemini',
    };

    functions.logger.info('Screenshot compliance review route resolved', {
      providerType: routeResolution.route.providerType,
      model: routeResolution.route.model,
      kind: routeResolution.kind,
      workflow: routeResolution.workflow,
    });

    // Keep this review lightweight. Full rewrites happen in a separate refine pass.
    const prompt = `Review this screenshot-derived document draft against the user's prompt and PROMPT rules.

User prompt:
${userPrompt?.trim() || '(none)'}

Rules:
${rulesText?.trim() || '(none)'}

Draft:
${draft}

Respond with JSON only (no full document rewrite):
{"passed": true|false, "summary": "short note about rule adherence"}`;

    const profile = 'deterministicUtility';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
      { maxOutputTokens: 1024 },
    );

    const text = ctx.usesExternalProvider
      ? await generateExternalProviderText(
          ctx,
          prompt,
          { model: ctx.resolution.route.model, maxOutputTokens: 1024 },
          'Screenshot rule compliance review',
          { profile },
        )
      : await GeminiService.generateContent(
          prompt,
          toGeminiContentOptions(runtimeConfig),
        );

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        passed: true,
        summary: 'Compliance review returned non-JSON; keeping draft',
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        passed?: boolean;
        summary?: string;
      };
      return {
        passed: parsed.passed !== false,
        summary:
          typeof parsed.summary === 'string' ? parsed.summary : undefined,
      };
    } catch {
      return {
        passed: true,
        summary: 'Compliance review JSON parse failed; keeping draft',
      };
    }
  }

  static async refineScreenshotDocumentForRules(
    routeResolution: GenerationRouteResolution,
    draft: string,
    rulesText: string,
    complianceSummary?: string,
    userPrompt?: string,
  ): Promise<string> {
    const ctx: TextRouteContext = {
      resolution: routeResolution,
      usesExternalProvider: routeResolution.route.providerType !== 'gemini',
    };

    const prompt = `Rewrite the screenshot-derived draft so it FULLY satisfies the Domain Rules.

User prompt:
${userPrompt?.trim() || '(none)'}

Domain Rules:
${rulesText.trim()}

Compliance findings to fix:
${complianceSummary?.trim() || '(rules were not satisfied)'}

Current draft:
${draft}

Requirements:
- Output ONLY the corrected HTML fragment (no JSON, no preamble).
- Apply Domain Rules exactly as written. Do not add assumptions beyond what the rules require.
- Preserve code blocks and any content the Domain Rules say to leave unchanged.
- Do NOT invent a comprehensive learning guide, glossary, or tutorial unless Domain Rules ask for it.
- Do NOT include Mermaid, Plotly, or LaTeX unless Domain Rules ask for them.`;

    const profile = 'deterministicUtility';
    const runtimeConfig = await buildGenerationConfig(
      ctx.resolution.route.model,
      profile,
      { temperature: 0.3, maxOutputTokens: 16384 },
    );

    const text = ctx.usesExternalProvider
      ? await generateExternalProviderText(
          ctx,
          prompt,
          {
            model: ctx.resolution.route.model,
            temperature: 0.3,
            maxOutputTokens: 16384,
          },
          'Screenshot rule refine',
          { profile },
        )
      : await GeminiService.generateContent(
          prompt,
          toGeminiContentOptions(runtimeConfig),
        );

    return GeminiService.sanitizeDocumentResponse(stripCodeFences(text));
  }
}
