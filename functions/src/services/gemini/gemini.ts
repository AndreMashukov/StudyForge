// Box-drawing and arrow characters used for ASCII diagram detection.
// Multi-codepoint emoji are matched via explicit alternation (not character
// classes) to stay compliant with Biome's noMisleadingCharacterClass rule.
import { GoogleGenAI } from '@google/genai';
import * as functions from 'firebase-functions';
import {
  ScrapedContent,
  QuizFollowupContext,
  DocumentQuestionContext,
  IFileContent,
} from '@shared-types';
import { JsonSanitizer } from './json-sanitizer';
import {
  QuizPromptBuilder,
  FollowupPromptBuilder,
  DocumentPromptBuilder,
  DocumentQuestionPromptBuilder,
  FlashcardPromptBuilder,
  SlideDeckPromptBuilder,
  DiagramQuizPromptBuilder,
  SequenceQuizPromptBuilder,
} from './prompt-builder';
import {
  buildPromptWithContextFiles,
  validateContextFiles,
  estimateContextTokens,
} from './prompt-builder/withContextFiles';

const GEMINI_PRO_MODEL = 'gemini-pro-latest';

export interface GeminiQuizResponse {
  title: string;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>;
}

export interface GeminiDiagramQuizResponse {
  title: string;
  questions: Array<{
    question: string;
    diagrams: string[];
    correctAnswer: number;
    explanation: string;
    diagramLabels?: string[];
  }>;
}

export interface GeminiSequenceQuizResponse {
  title: string;
  questions: Array<{
    question: string;
    items: string[];
    explanation: string;
  }>;
}

/**
 * Detects box-drawing / arrow characters that indicate an ASCII diagram.
 * Multi-codepoint emoji (✅ ❌ ⚠️ 🔄 ⭐) are tested via explicit alternation
 * rather than inside a character class to satisfy Biome noMisleadingCharacterClass.
 */
const ASCII_DIAGRAM_RE = /[╔╗╚╝║═┌┐└┘│─→←↑↓]|✅|❌|⚠️|🔄|⭐/u;

/**
 * Service for interacting with Google's Gemini AI for quiz generation and content processing
 */
export class GeminiService {
  /**
   * Get the Gemini AI client instance
   */
  private static getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Gemini API key not found. Please configure GEMINI_API_KEY in environment variables or Firebase runtime config (gemini.api_key).'
      );
    }

    return new GoogleGenAI({ apiKey });
  }

  /**
   * Generate a quiz from scraped content using Gemini AI
   */
  public static async generateQuiz(
    content: ScrapedContent,
    additionalPrompt?: string
  ): Promise<GeminiQuizResponse> {
    try {
      functions.logger.info('Generating quiz with Gemini AI for document...');

      // Validate content for patterns that might cause JSON issues
      JsonSanitizer.validateContentForSafeGeneration(content.content);

      const client = this.getClient();

      // Generate random correct answer pattern (up to 30 questions)
      // Assuming typical quiz length of 8-12 questions, we generate 30 to cover all cases
      const randomCorrectAnswers =
        QuizPromptBuilder.generateRandomCorrectAnswers(30);

      functions.logger.info('Generated random correct answer pattern', {
        patternLength: randomCorrectAnswers.length,
        pattern: randomCorrectAnswers.slice(0, 12).join(','), // Log first 12 for debugging
      });

      const prompt = QuizPromptBuilder.buildQuizPrompt(
        content,
        additionalPrompt,
        randomCorrectAnswers
      );
      functions.logger.debug('Sending request to Gemini AI', {
        contentLength: content.content.length,
      });

      const response = await client.models.generateContent({
        model: GEMINI_PRO_MODEL,
        contents: prompt,
      });

      const text = response.text;

      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      functions.logger.info('Quiz generated successfully', {
        length: text.length,
      });

      // Parse the response with comprehensive error handling
      return this.parseQuizResponse(text);
    } catch (error) {
      functions.logger.error('Error generating quiz with Gemini AI:', error);

      // Handle geographic restrictions — fall back to mock data only in the
      // local emulator, never in production.
      const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
      if (
        isEmulator &&
        error instanceof Error &&
        error.message.includes('User location is not supported')
      ) {
        functions.logger.warn(
          'Geographic restriction detected in local emulator, falling back to mock quiz'
        );
        return this.generateMockQuiz(content);
      }

      throw new Error(`Failed to generate quiz: ${error}`);
    }
  }

  /**
   * Generate a diagram quiz: four Mermaid diagrams per question as answer options.
   */
  public static async generateDiagramQuiz(
    content: ScrapedContent,
    additionalPrompt?: string
  ): Promise<GeminiDiagramQuizResponse> {
    try {
      functions.logger.info('Generating diagram quiz with Gemini AI...');
      JsonSanitizer.validateContentForSafeGeneration(content.content);

      const client = this.getClient();
      const randomCorrectAnswers =
        DiagramQuizPromptBuilder.generateRandomCorrectAnswers(20);
      const prompt = DiagramQuizPromptBuilder.buildDiagramQuizPrompt(
        content,
        additionalPrompt,
        randomCorrectAnswers
      );

      const response = await client.models.generateContent({
        model: GEMINI_PRO_MODEL,
        contents: prompt,
        config: {
          temperature: 0.4,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 16384,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      return this.parseDiagramQuizResponse(text);
    } catch (error) {
      functions.logger.error('Error generating diagram quiz:', error);
      const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
      if (
        isEmulator &&
        error instanceof Error &&
        error.message.includes('User location is not supported')
      ) {
        functions.logger.warn(
          'Geographic restriction in emulator, falling back to mock diagram quiz'
        );
        return this.generateMockDiagramQuiz(content);
      }
      throw new Error(
        `Failed to generate diagram quiz: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Generate a sequence quiz: items that the learner must drag into the correct order.
   * The prompt is domain-agnostic by design — specialisation is injected via rules.
   */
  public static async generateSequenceQuiz(
    content: ScrapedContent,
    additionalPrompt?: string
  ): Promise<GeminiSequenceQuizResponse> {
    try {
      functions.logger.info('Generating sequence quiz with Gemini AI...');
      JsonSanitizer.validateContentForSafeGeneration(content.content);

      const client = this.getClient();
      const prompt = SequenceQuizPromptBuilder.buildSequenceQuizPrompt(
        content,
        additionalPrompt
      );

      const response = await client.models.generateContent({
        model: GEMINI_PRO_MODEL,
        contents: prompt,
        config: {
          temperature: 0.4,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 16384,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      return this.parseSequenceQuizResponse(text);
    } catch (error) {
      functions.logger.error('Error generating sequence quiz:', error);
      const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
      if (
        isEmulator &&
        error instanceof Error &&
        error.message.includes('User location is not supported')
      ) {
        functions.logger.warn(
          'Geographic restriction in emulator, falling back to mock sequence quiz'
        );
        return this.generateMockSequenceQuiz(content);
      }
      throw new Error(
        `Failed to generate sequence quiz: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Generate general content using Gemini AI
   * Used for markdown conversion and other text generation tasks
   */
  public static async generateContent(prompt: string): Promise<string> {
    try {
      functions.logger.info('Generating content with Gemini AI');

      const client = this.getClient();

      const fullPrompt = QuizPromptBuilder.buildContentPrompt(prompt);
      const response = await client.models.generateContent({
        model: GEMINI_PRO_MODEL,
        contents: fullPrompt,
        config: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      });

      const text = response.text;

      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      functions.logger.info('Content generated successfully', {
        length: text.length,
      });
      return text;
    } catch (error) {
      functions.logger.error('Error generating content with Gemini AI:', error);
      throw new Error(`Failed to generate content: ${error}`);
    }
  }

  /**
   * Generate a comprehensive document from a user text prompt
   * Creates structured markdown with tables, ASCII diagrams, and detailed content
   * @param userPrompt - The user's text prompt describing what document to generate
   * @param files - Optional array of reference documents to use as context
   * @returns Generated markdown document content
   */
  public static async generateDocumentFromPrompt(
    userPrompt: string,
    files?: IFileContent[]
  ): Promise<string> {
    try {
      functions.logger.info('Generating document from prompt with Gemini AI', {
        promptLength: userPrompt.length,
        filesCount: files?.length || 0,
      });

      // Validate context files if provided
      if (files && files.length > 0) {
        validateContextFiles(files);
        const estimatedTokens = estimateContextTokens(files);
        functions.logger.info('Context files validated', {
          filesCount: files.length,
          estimatedTokens,
        });
      }

      const client = this.getClient();

      // Use context-aware prompt builder if files provided
      const prompt =
        files && files.length > 0
          ? buildPromptWithContextFiles(userPrompt, files)
          : DocumentPromptBuilder.buildDocumentPrompt(userPrompt);

      functions.logger.debug(
        'Sending document generation request to Gemini AI',
        {
          promptLength: prompt.length,
          hasContextFiles: !!(files && files.length > 0),
        }
      );

      const response = await client.models.generateContent({
        model: GEMINI_PRO_MODEL,
        contents: prompt,
        config: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 16384, // Higher limit for comprehensive documents
        },
      });

      const text = response.text;

      if (!text) {
        throw new Error(
          'Empty response from Gemini API for document generation'
        );
      }

      // Validate and clean the generated content
      const validatedContent = this.validateAndFixDocumentContent(text);

      functions.logger.info('Document generated successfully', {
        length: validatedContent.length,
        wasFixed: validatedContent !== text,
        withContext: !!(files && files.length > 0),
      });

      return validatedContent;
    } catch (error) {
      functions.logger.error(
        'Error generating document from prompt with Gemini AI:',
        error
      );
      throw new Error(
        `Failed to generate document: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Generate comprehensive followup explanation for quiz question
   * @param context - Complete context including original document and question details
   * @returns Generated markdown content with ASCII diagrams
   */
  public static async generateQuizFollowup(
    context: QuizFollowupContext
  ): Promise<string> {
    try {
      functions.logger.info(
        'Generating quiz followup explanation with Gemini AI'
      );

      const client = this.getClient();

      const prompt = FollowupPromptBuilder.buildFollowupPrompt(context);
      functions.logger.debug('Sending followup request to Gemini AI', {
        questionLength: context.question.text.length,
        documentLength: context.originalDocument.content.length,
      });

      const response = await client.models.generateContent({
        model: GEMINI_PRO_MODEL,
        contents: prompt,
        config: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      });

      const text = response.text;

      if (!text) {
        throw new Error(
          'Empty response from Gemini API for followup generation'
        );
      }

      // Validate and potentially fix the followup content format
      const validatedContent = this.validateAndFixFollowupContent(text);

      functions.logger.info('Quiz followup generated successfully', {
        length: validatedContent.length,
        wasFixed: validatedContent !== text,
      });
      return validatedContent;
    } catch (error) {
      functions.logger.error(
        'Error generating quiz followup with Gemini AI:',
        error
      );
      throw new Error(
        `Failed to generate followup: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Generate an answer to a user's question about a document
   * @param context - Document content and user question
   * @returns Generated markdown answer
   */
  public static async generateDocumentQuestionAnswer(
    context: DocumentQuestionContext
  ): Promise<string> {
    try {
      functions.logger.info(
        'Generating document question answer with Gemini AI'
      );

      const client = this.getClient();

      const prompt = DocumentQuestionPromptBuilder.buildPrompt(context);
      functions.logger.debug('Sending document question to Gemini AI', {
        questionLength: context.question.length,
        documentLength: context.document.content.length,
      });

      const response = await client.models.generateContent({
        model: GEMINI_PRO_MODEL,
        contents: prompt,
        config: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      });

      const text = response.text;

      if (!text) {
        throw new Error(
          'Empty response from Gemini API for document question'
        );
      }

      const validatedContent = this.validateAndFixFollowupContent(text);

      functions.logger.info('Document question answer generated successfully', {
        length: validatedContent.length,
      });
      return validatedContent;
    } catch (error) {
      functions.logger.error(
        'Error generating document question answer with Gemini AI:',
        error
      );
      throw new Error(
        `Failed to generate answer: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Generate a set of flashcards from document content.
   */
  public static async generateFlashcards(
    content: string,
    rules?: string
  ): Promise<{ front: string; back: string }[]> {
    try {
      functions.logger.info('Generating flashcards with Gemini AI...');

      const client = this.getClient();

      const prompt = FlashcardPromptBuilder.buildFlashcardPrompt(
        content,
        rules
      );
      functions.logger.debug(
        'Sending flashcard generation request to Gemini AI',
        { contentLength: content.length }
      );

      const response = await client.models.generateContent({
        model: GEMINI_PRO_MODEL,
        contents: prompt,
      });

      const text = response.text;

      if (!text) {
        throw new Error(
          'Empty response from Gemini API for flashcard generation'
        );
      }

      const flashcards = this.parseFlashcardResponse(text);

      // Basic validation of card structure
      flashcards.forEach((card, index) => {
        if (!card.front || !card.back) {
          throw new Error(
            `Invalid flashcard object at index ${index}: missing 'front' or 'back' field.`
          );
        }
      });

      functions.logger.info(
        `Generated ${flashcards.length} flashcards successfully.`
      );
      return flashcards;
    } catch (error) {
      functions.logger.error(
        'Error generating flashcards with Gemini AI:',
        error
      );
      throw new Error(`Failed to generate flashcards: ${error}`);
    }
  }

  /**
   * Extract and parse a JSON array from a Gemini flashcard response.
   * Handles markdown code fences, extra surrounding text, and both [] and {} top-level structures.
   */
  private static parseFlashcardResponse(
    responseText: string
  ): { front: string; back: string }[] {
    let text = responseText.trim();

    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    text = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    // Try direct parse first (happy path)
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      throw new Error('Parsed value is not an array');
    } catch {
      // Fall through to extraction strategies
    }

    // Extract the first JSON array [...] from the response
    const arrayMatch = text.match(/(\[[\s\S]*\])/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[1]);
        if (Array.isArray(parsed)) {
          functions.logger.info(
            'Extracted JSON array from flashcard response using array pattern'
          );
          return parsed;
        }
      } catch {
        // Fall through
      }
    }

    // Last resort: apply full sanitizer pipeline then look for an array
    const sanitized = JsonSanitizer.initialCleanup(text);
    const sanitizedArrayMatch = sanitized.match(/(\[[\s\S]*\])/);
    if (sanitizedArrayMatch) {
      const parsed = JSON.parse(sanitizedArrayMatch[1]);
      if (Array.isArray(parsed)) {
        functions.logger.info(
          'Extracted JSON array from flashcard response after sanitization'
        );
        return parsed;
      }
    }

    throw new Error(
      'Could not extract a valid JSON array from the flashcard response'
    );
  }

  /**
   * Parse the JSON response from Gemini AI with comprehensive error handling
   */
  private static parseQuizResponse(responseText: string): GeminiQuizResponse {
    let cleanText = '';
    try {
      // Initial cleanup
      cleanText = JsonSanitizer.initialCleanup(responseText);

      // Apply sanitization to handle common problematic patterns
      cleanText = JsonSanitizer.sanitizeJsonText(cleanText);

      // Apply comprehensive cleanup
      cleanText = JsonSanitizer.applyComprehensiveCleanup(cleanText);

      // Apply state-based character processing for advanced cleanup
      const result = JsonSanitizer.applyStateBased(cleanText);
      cleanText = result;

      // Attempt to parse the cleaned JSON
      const parsed = JSON.parse(cleanText);

      // Validate the structure
      this.validateQuizStructure(parsed);

      functions.logger.info(
        `Parsed quiz with ${parsed.questions.length} questions`
      );

      return parsed as GeminiQuizResponse;
    } catch (error) {
      // Log detailed error information
      JsonSanitizer.logParsingError(error, responseText, cleanText);

      // Try fallback parsing strategies before giving up
      try {
        const fallbackResult = JsonSanitizer.tryFallbackParsing(cleanText);
        this.validateQuizStructure(fallbackResult);
        return fallbackResult as GeminiQuizResponse;
      } catch (fallbackError) {
        functions.logger.error('All parsing strategies failed:', fallbackError);
      }

      throw new Error(`Failed to parse quiz response: ${error}`);
    }
  }

  /**
   * Validate the quiz structure and content
   */
  private static validateQuizStructure(parsed: {
    title?: unknown;
    questions?: unknown;
  }): void {
    if (!parsed.title || !Array.isArray(parsed.questions)) {
      throw new Error(
        'Invalid quiz structure: missing title or questions array'
      );
    }

    // Validate each question
    parsed.questions.forEach((q: unknown, index: number) => {
      const question = q as Record<string, unknown>;
      if (
        !question.question ||
        !Array.isArray(question.options) ||
        typeof question.correctAnswer !== 'number'
      ) {
        throw new Error(`Invalid question structure at index ${index}`);
      }

      if (question.options.length !== 4) {
        throw new Error(`Question ${index + 1} must have exactly 4 options`);
      }

      if (question.correctAnswer < 0 || question.correctAnswer > 3) {
        throw new Error(
          `Question ${index + 1} has invalid correctAnswer index`
        );
      }

      // Validate mandatory explanation
      if (
        !question.explanation ||
        typeof question.explanation !== 'string' ||
        question.explanation.trim().length === 0
      ) {
        throw new Error(
          `Question ${index + 1} is missing required explanation`
        );
      }
    });

    // Validate answer distribution
    this.validateAnswerDistribution(
      parsed.questions as Array<{ correctAnswer: number }>
    );
  }

  /**
   * Validate answer distribution follows the balanced distribution rules
   */
  private static validateAnswerDistribution(
    questions: Array<{ correctAnswer: number }>
  ): void {
    const totalQuestions = questions.length;
    if (totalQuestions === 0) return;

    const distribution = [0, 0, 0, 0]; // A, B, C, D
    questions.forEach((q) => distribution[q.correctAnswer]++);

    const minExpected = Math.floor(totalQuestions * 0.2); // 20%
    const maxExpected = Math.ceil(totalQuestions * 0.4); // 40%

    distribution.forEach((count, index) => {
      const option = String.fromCharCode(65 + index); // A, B, C, D
      if (count < minExpected) {
        functions.logger.warn(
          `Answer distribution warning: Option ${option} is correct only ${count} times (${(
            (count / totalQuestions) *
            100
          ).toFixed(1)}%). Consider rebalancing.`
        );
      }
      if (count > maxExpected) {
        functions.logger.warn(
          `Answer distribution warning: Option ${option} is correct ${count} times (${(
            (count / totalQuestions) *
            100
          ).toFixed(1)}%). Consider rebalancing.`
        );
      }
    });

    // Check for consecutive same answers (anti-clustering)
    let consecutiveCount = 1;
    let maxConsecutive = 1;
    for (let i = 1; i < questions.length; i++) {
      if (questions[i].correctAnswer === questions[i - 1].correctAnswer) {
        consecutiveCount++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
      } else {
        consecutiveCount = 1;
      }
    }

    if (maxConsecutive > 2) {
      functions.logger.warn(
        `Answer clustering detected: ${maxConsecutive} consecutive questions have the same correct answer. Consider rebalancing.`
      );
    }

    functions.logger.info('Answer distribution analysis:', {
      total: totalQuestions,
      distribution: {
        A: distribution[0],
        B: distribution[1],
        C: distribution[2],
        D: distribution[3],
      },
      maxConsecutive,
    });
  }

  /**
   * Generate a mock quiz for development/fallback purposes
   */
  private static generateMockQuiz(content: ScrapedContent): GeminiQuizResponse {
    functions.logger.info('Generating mock quiz for development');

    return {
      title: `Mock Quiz: ${content.title}`,
      questions: [
        {
          question:
            'This is a mock question for development purposes. What should you do?',
          options: [
            'Configure Gemini API properly',
            'Use a different region',
            'Continue with mock data',
            'Check geographic restrictions',
          ],
          correctAnswer: 0,
          explanation:
            'The Gemini API needs to be properly configured for your region.',
        },
        {
          question: 'Why might you see this mock quiz?',
          options: [
            'Internet connection issues',
            'Geographic restrictions or API configuration issues',
            'Invalid content format',
            'Server overload',
          ],
          correctAnswer: 1,
          explanation:
            'Mock quizzes appear when there are geographic restrictions or API configuration issues.',
        },
      ],
    };
  }

  private static parseDiagramQuizResponse(
    responseText: string
  ): GeminiDiagramQuizResponse {
    let cleanText = '';
    try {
      cleanText = JsonSanitizer.initialCleanup(responseText);
      cleanText = JsonSanitizer.sanitizeJsonText(cleanText);
      cleanText = JsonSanitizer.applyComprehensiveCleanup(cleanText);
      cleanText = JsonSanitizer.applyStateBased(cleanText);
      const parsed = JSON.parse(cleanText);
      this.validateDiagramQuizStructure(parsed);
      return parsed as GeminiDiagramQuizResponse;
    } catch (error) {
      JsonSanitizer.logParsingError(error, responseText, cleanText);
      try {
        const fallbackResult = JsonSanitizer.tryFallbackParsing(cleanText);
        this.validateDiagramQuizStructure(fallbackResult);
        return fallbackResult as GeminiDiagramQuizResponse;
      } catch (fallbackError) {
        functions.logger.error('Diagram quiz parse failed:', fallbackError);
      }
      throw new Error(`Failed to parse diagram quiz response: ${error}`);
    }
  }

  private static validateDiagramQuizStructure(parsed: {
    title?: unknown;
    questions?: unknown;
  }): void {
    if (!parsed.title || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid diagram quiz: missing title or questions');
    }
    (parsed.questions as unknown[]).forEach((q, index) => {
      const row = q as Record<string, unknown>;
      if (!row.question || typeof row.question !== 'string') {
        throw new Error(`Diagram quiz question ${index + 1}: invalid question`);
      }
      if (!Array.isArray(row.diagrams) || row.diagrams.length !== 4) {
        throw new Error(
          `Diagram quiz question ${index + 1}: diagrams must be length 4`
        );
      }
      for (const d of row.diagrams) {
        if (typeof d !== 'string' || d.trim().length === 0) {
          throw new Error(
            `Diagram quiz question ${index + 1}: each diagram must be non-empty string`
          );
        }
      }
      if (
        typeof row.correctAnswer !== 'number' ||
        row.correctAnswer < 0 ||
        row.correctAnswer > 3
      ) {
        throw new Error(
          `Diagram quiz question ${index + 1}: invalid correctAnswer`
        );
      }
      if (
        !row.explanation ||
        typeof row.explanation !== 'string' ||
        row.explanation.trim().length === 0
      ) {
        throw new Error(
          `Diagram quiz question ${index + 1}: missing explanation`
        );
      }
    });
  }

  private static generateMockDiagramQuiz(
    content: ScrapedContent
  ): GeminiDiagramQuizResponse {
    const d = (body: string) =>
      `flowchart TD\n${body}`.replace(/"/g, "'");
    return {
      title: `Mock Diagram Quiz: ${content.title}`,
      questions: [
        {
          question: 'Which flowchart shows a linear A then B flow?',
          diagrams: [
            d('A-->B'),
            d('A-->C\nC-->B'),
            d('B-->A'),
            d('A-->B\nB-->C'),
          ],
          correctAnswer: 0,
          explanation:
            'The first diagram shows a direct edge from A to B. Others add branches or reverse order.',
        },
        {
          question: 'Mock question two (development only)?',
          diagrams: [d('X-->Y'), d('Y-->X'), d('X-->Z'), d('Z-->Y')],
          correctAnswer: 0,
          explanation: 'Mock explanation for local emulator testing.',
        },
      ],
    };
  }

  private static parseSequenceQuizResponse(
    responseText: string
  ): GeminiSequenceQuizResponse {
    let cleanText = '';
    try {
      cleanText = JsonSanitizer.initialCleanup(responseText);
      cleanText = JsonSanitizer.sanitizeJsonText(cleanText);
      cleanText = JsonSanitizer.applyComprehensiveCleanup(cleanText);
      cleanText = JsonSanitizer.applyStateBased(cleanText);
      const parsed = JSON.parse(cleanText);
      this.validateSequenceQuizStructure(parsed);
      return parsed as GeminiSequenceQuizResponse;
    } catch (error) {
      JsonSanitizer.logParsingError(error, responseText, cleanText);
      try {
        const fallbackResult = JsonSanitizer.tryFallbackParsing(cleanText);
        this.validateSequenceQuizStructure(fallbackResult);
        return fallbackResult as GeminiSequenceQuizResponse;
      } catch (fallbackError) {
        functions.logger.error('Sequence quiz parse failed:', fallbackError);
      }
      throw new Error(`Failed to parse sequence quiz response: ${error}`);
    }
  }

  private static validateSequenceQuizStructure(parsed: {
    title?: unknown;
    questions?: unknown;
  }): void {
    if (typeof parsed.title !== 'string' || parsed.title.trim().length === 0) {
      throw new Error('Invalid sequence quiz: title must be a non-empty string');
    }
    if (!Array.isArray(parsed.questions)) {
      throw new Error('Invalid sequence quiz: questions must be an array');
    }
    const qCount = parsed.questions.length;
    if (qCount < 8 || qCount > 12) {
      throw new Error(
        `Invalid sequence quiz: expected between 8 and 12 questions, got ${qCount}`
      );
    }
    (parsed.questions as unknown[]).forEach((q, index) => {
      const row = q as Record<string, unknown>;
      if (!row.question || typeof row.question !== 'string') {
        throw new Error(`Sequence quiz question ${index + 1}: invalid question`);
      }
      if (
        !Array.isArray(row.items) ||
        row.items.length < 4 ||
        row.items.length > 10
      ) {
        throw new Error(
          `Sequence quiz question ${index + 1}: items must be an array with between 4 and 10 elements`
        );
      }
      for (const item of row.items) {
        if (typeof item !== 'string' || item.trim().length === 0) {
          throw new Error(
            `Sequence quiz question ${index + 1}: each item must be a non-empty string`
          );
        }
      }
      if (
        !row.explanation ||
        typeof row.explanation !== 'string' ||
        row.explanation.trim().length === 0
      ) {
        throw new Error(
          `Sequence quiz question ${index + 1}: missing explanation`
        );
      }
    });
  }

  private static generateMockSequenceQuiz(
    content: ScrapedContent
  ): GeminiSequenceQuizResponse {
    return {
      title: `Mock Sequence Quiz: ${content.title}`,
      questions: [
        {
          question: 'Arrange these steps in the correct order:',
          items: [
            'Define the problem',
            'Gather requirements',
            'Design the solution',
            'Implement the solution',
            'Test and validate',
            'Deploy and monitor',
          ],
          explanation:
            'This is a standard software development lifecycle: define → gather → design → implement → test → deploy.',
        },
        {
          question: 'Arrange these items in order (mock question):',
          items: ['Step A', 'Step B', 'Step C', 'Step D'],
          explanation: 'Mock explanation for local emulator testing.',
        },
      ],
    };
  }

  /**
   * Validate content for quiz generation
   * @param content - The content to validate
   */
  public static validateContentForQuiz(content: {
    title: string;
    content: string;
    wordCount: number;
  }): void {
    if (!content.title || content.title.trim().length === 0) {
      throw new Error('Content must have a title');
    }

    if (!content.content || content.content.trim().length === 0) {
      throw new Error('Content cannot be empty');
    }

    if (content.wordCount < 50) {
      throw new Error(
        'Content is too short for quiz generation (minimum 50 words required)'
      );
    }

    if (content.wordCount > 10000) {
      functions.logger.warn(
        `Content is very long (${content.wordCount} words), quiz generation may take longer`
      );
    }

    // Check for potentially problematic patterns
    if (
      content.content.includes('```') ||
      content.content.includes('{') ||
      content.content.includes('}')
    ) {
      functions.logger.info(
        'Content contains code-like patterns, will sanitize during generation'
      );
    }
  }

  /**
   * Validate and fix followup content to ensure proper ASCII diagram formatting
   * @param content - Generated followup content to validate and fix
   * @returns Fixed content
   */
  private static validateAndFixFollowupContent(content: string): string {
    try {
      let processedContent = content;

      // First, check if the entire content is wrapped in a markdown code block and remove it
      const markdownCodeBlockRegex = /^```markdown\s*\n([\s\S]*?)\n```$/;
      const markdownMatch = processedContent.match(markdownCodeBlockRegex);
      if (markdownMatch) {
        processedContent = markdownMatch[1];
        functions.logger.info(
          'Removed markdown code block wrapper from followup content'
        );
      }

      // Also check for other code block wrappers that might be used
      const genericCodeBlockRegex = /^```\s*\n([\s\S]*?)\n```$/;
      const genericMatch = processedContent.match(genericCodeBlockRegex);
      if (genericMatch && !markdownMatch) {
        // Only remove if it wasn't already processed as markdown
        processedContent = genericMatch[1];
        functions.logger.info(
          'Removed generic code block wrapper from followup content'
        );
      }

      // Check for required sections
      const requiredSections = [
        '# Question Analysis',
        '## Core Concept Explanation',
        '## Answer Analysis',
        '## Diagram 1:',
        '## Diagram 2:',
        '## Key Takeaways',
        '## Connection to Original Document',
      ];

      const missingSections = requiredSections.filter(
        (section) => !processedContent.includes(section)
      );

      if (missingSections.length > 0) {
        functions.logger.warn(
          'Missing sections in followup content:',
          missingSections
        );
      }

      // Check for ASCII diagrams in code blocks
      const codeBlockRegex = /```[\s\S]*?```/g;
      const codeBlocks = processedContent.match(codeBlockRegex);

      if (!codeBlocks || codeBlocks.length < 2) {
        functions.logger.warn(
          'Less than 2 code blocks found in followup content. ASCII diagrams may not be properly formatted.'
        );

        // Attempt to fix common ASCII diagram formatting issues
        const fixedContent = this.fixAsciiDiagramFormatting(processedContent);
        if (fixedContent !== processedContent) {
          functions.logger.info('Applied ASCII diagram formatting fixes');
          return fixedContent; // Return fixed content
        }
      }

      // Check if ASCII diagrams contain proper symbols
      if (codeBlocks) {
        const hasAsciiSymbols = codeBlocks.some((block) =>
          ASCII_DIAGRAM_RE.test(block)
        );

        if (!hasAsciiSymbols) {
          functions.logger.warn(
            'No ASCII symbols detected in code blocks. Diagrams may be improperly formatted.'
          );
        }
      }

      functions.logger.info('Followup content validation passed');
      return processedContent; // Content is properly formatted
    } catch (error) {
      functions.logger.error('Error validating followup content:', error);
      return content; // Return original content on error
    }
  }

  /**
   * Attempt to fix common ASCII diagram formatting issues
   * @param content - Content with potential formatting issues
   * @returns Fixed content
   */
  private static fixAsciiDiagramFormatting(content: string): string {
    const fixedContent = content;
    const lines = fixedContent.split('\n');
    const result: string[] = [];
    let inAsciiBlock = false;
    let asciiBuffer: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if line contains ASCII diagram characters (box-drawing / arrows /
      // emoji only — plain +, -, | are excluded to avoid false positives on
      // markdown lists and tables).
      const hasAsciiChars = ASCII_DIAGRAM_RE.test(line);
      const isCodeBlock = line.startsWith('```');

      if (hasAsciiChars && !isCodeBlock && !inAsciiBlock) {
        // Start of ASCII block
        inAsciiBlock = true;
        result.push('```');
        asciiBuffer = [lines[i]];
      } else if (inAsciiBlock) {
        if (hasAsciiChars || line === '') {
          // Continue ASCII block
          asciiBuffer.push(lines[i]);
        } else {
          // End of ASCII block
          result.push(...asciiBuffer);
          result.push('```');
          result.push(lines[i]);
          inAsciiBlock = false;
          asciiBuffer = [];
        }
      } else {
        result.push(lines[i]);
      }
    }

    // Handle case where ASCII block goes to end of content
    if (inAsciiBlock && asciiBuffer.length > 0) {
      result.push(...asciiBuffer);
      result.push('```');
    }

    return result.join('\n');
  }

  /**
   * Validate and fix document content to ensure proper formatting
   * @param content - Generated document content to validate and fix
   * @returns Fixed content
   */
  private static validateAndFixDocumentContent(content: string): string {
    try {
      let processedContent = content;

      // Remove markdown code block wrapper if present
      const markdownCodeBlockRegex = /^```markdown\s*\n([\s\S]*?)\n```$/;
      const markdownMatch = processedContent.match(markdownCodeBlockRegex);
      if (markdownMatch) {
        processedContent = markdownMatch[1];
        functions.logger.info(
          'Removed markdown code block wrapper from document content'
        );
      }

      // Remove generic code block wrapper if present
      const genericCodeBlockRegex = /^```\s*\n([\s\S]*?)\n```$/;
      const genericMatch = processedContent.match(genericCodeBlockRegex);
      if (genericMatch && !markdownMatch) {
        processedContent = genericMatch[1];
        functions.logger.info(
          'Removed generic code block wrapper from document content'
        );
      }

      // Check for required sections
      const requiredSections = [
        '## Glossary',
        '## Core Concepts',
        '## Examples',
        '## Summary',
      ];

      const missingSections = requiredSections.filter(
        (section) => !processedContent.includes(section)
      );

      if (missingSections.length > 0) {
        functions.logger.warn(
          'Missing sections in document content:',
          missingSections
        );
      }

      // Check for tables
      const tableRegex = /\|.*\|.*\n\|[-:| ]+\|/g;
      const tables = processedContent.match(tableRegex);

      if (!tables || tables.length === 0) {
        functions.logger.warn('No markdown tables found in document content');
      } else {
        functions.logger.info(`Found ${tables.length} table(s) in document`);
      }

      // Check for ASCII diagrams in code blocks
      const codeBlockRegex = /```[\s\S]*?```/g;
      const codeBlocks = processedContent.match(codeBlockRegex);

      if (!codeBlocks || codeBlocks.length < 2) {
        functions.logger.warn(
          'Less than 2 code blocks found in document content. ASCII diagrams may not be properly formatted.'
        );
      } else {
        // Count blocks that contain ASCII art characters
        const asciiBlocks = codeBlocks.filter((block) =>
          ASCII_DIAGRAM_RE.test(block)
        );
        functions.logger.info(
          `Found ${asciiBlocks.length} ASCII diagram(s) in document`
        );
      }

      // Check word count (approximate)
      const wordCount = processedContent.split(/\s+/).length;
      functions.logger.info(`Document word count: ${wordCount}`);

      if (wordCount < 1000) {
        functions.logger.warn(
          `Document word count (${wordCount}) is below minimum requirement (1000)`
        );
      }

      functions.logger.info('Document content validation passed');
      return processedContent;
    } catch (error) {
      functions.logger.error('Error validating document content:', error);
      return content; // Return original content on error
    }
  }

  /**
   * Get model information and availability
   * @returns Model info including availability status
   */
  /**
   * Generate a slide deck outline from document content.
   * Returns structured slide data (title, content, speaker notes per slide).
   */
  public static async generateSlideDeckOutline(
    content: string,
    additionalPrompt?: string,
    rules?: string
  ): Promise<Array<{ title: string; content: string; speakerNotes?: string }>> {
    try {
      functions.logger.info('Generating slide deck outline with Gemini AI...');

      const client = this.getClient();

      const prompt = SlideDeckPromptBuilder.buildSlideOutlinePrompt(
        content,
        additionalPrompt,
        rules
      );
      const response = await client.models.generateContent({
        model: GEMINI_PRO_MODEL,
        contents: prompt,
        config: { temperature: 0.7, topK: 40, topP: 0.95 },
      });

      const text = response.text;

      if (!text) {
        throw new Error(
          'Empty response from Gemini API for slide deck generation'
        );
      }

      let cleanText = text.trim();
      // Strip markdown code fences if present
      cleanText = cleanText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');
      cleanText = JsonSanitizer.sanitizeJsonText(cleanText);

      const parsed = JSON.parse(cleanText);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error(
          'Invalid slide deck response: expected non-empty array'
        );
      }

      functions.logger.info('Raw parsed slide outline:', {
        slideCount: parsed.length,
        firstSlideKeys: Object.keys(parsed[0] ?? {}),
      });

      const slides = parsed.map((item: Record<string, unknown>, i: number) => {
        if (typeof item.title !== 'string' || !item.title.trim()) {
          throw new Error(`Slide ${i}: missing or empty "title"`);
        }

        // Resolve content from several possible field names Gemini may use
        let resolvedContent: string | undefined;
        if (typeof item.content === 'string' && item.content.trim()) {
          resolvedContent = item.content;
        } else if (Array.isArray(item.content)) {
          resolvedContent = (item.content as unknown[]).map(String).join('\n');
        } else if (typeof item.bullets === 'string' && item.bullets.trim()) {
          resolvedContent = item.bullets;
        } else if (Array.isArray(item.bullets)) {
          resolvedContent = (item.bullets as unknown[])
            .map((b) => `• ${b}`)
            .join('\n');
        } else if (typeof item.body === 'string' && item.body.trim()) {
          resolvedContent = item.body;
        } else if (typeof item.points === 'string' && item.points.trim()) {
          resolvedContent = item.points;
        } else if (Array.isArray(item.points)) {
          resolvedContent = (item.points as unknown[])
            .map((p) => `• ${p}`)
            .join('\n');
        }

        if (!resolvedContent) {
          functions.logger.warn(
            `Slide ${i} has no recognisable content field.`,
            { slideIndex: i, keys: Object.keys(item) }
          );
          throw new Error(
            `Slide ${i}: missing or empty content (checked: content, bullets, body, points)`
          );
        }

        return {
          title: item.title.trim(),
          content: resolvedContent.trim(),
          speakerNotes:
            typeof item.speakerNotes === 'string'
              ? item.speakerNotes
              : undefined,
        };
      });

      functions.logger.info(`Generated ${slides.length} slides successfully.`);
      return slides;
    } catch (error) {
      functions.logger.error('Error generating slide deck outline:', error);
      throw error;
    }
  }

  /**
   * Generate a detailed image-generation brief for a slide using Gemini text model.
   * This brief describes layout, diagram, colors, icons, etc. based on rules.
   */
  public static async generateSlideImageBrief(
    slideTitle: string,
    slideContent: string,
    rules?: string
  ): Promise<string | null> {
    try {
      const client = this.getClient();
      const prompt = SlideDeckPromptBuilder.buildSlideImageBriefPrompt(
        slideTitle,
        slideContent,
        rules
      );

      const response = await client.models.generateContent({
        model: GEMINI_PRO_MODEL,
        contents: prompt,
        config: { temperature: 0.7, topK: 40, topP: 0.95 },
      });

      const text = response.text?.trim();
      if (!text) {
        functions.logger.warn('Slide image brief: empty response from Gemini.');
        return null;
      }

      functions.logger.info('Slide image brief generated.', {
        slideTitle,
        briefLength: text.length,
      });
      return text;
    } catch (error) {
      functions.logger.warn('Slide image brief generation failed (non-fatal):', error);
      return null;
    }
  }

  /**
   * Generate a slide image using Gemini image generation model.
   * Uses @google/genai SDK with gemini-3.1-flash-image-preview.
   * Returns base64-encoded PNG image data.
   */
  public static async generateSlideImage(
    slideTitle: string,
    slideContent: string,
    rules?: string
  ): Promise<string | null> {
    try {
      const client = this.getClient();
      const prompt = SlideDeckPromptBuilder.buildSlideImagePrompt(
        slideTitle,
        slideContent,
        rules
      );

      const response = await client.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: prompt,
        config: {
          responseModalities: ['IMAGE'],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts) return null;

      for (const part of parts) {
        if (part.inlineData?.data) {
          return part.inlineData.data; // base64 string
        }
      }

      functions.logger.warn('Slide image: no inline image data in response.');
      return null;
    } catch (error) {
      functions.logger.warn(
        'Slide image generation failed (non-fatal):',
        error
      );
      return null;
    }
  }

  /**
   * Generate a slide image from a pre-built prompt string.
   * Used in the two-phase flow where Gemini text model first builds a detailed brief.
   */
  public static async generateSlideImageFromPrompt(
    prompt: string
  ): Promise<string | null> {
    try {
      const client = this.getClient();

      const response = await client.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: prompt,
        config: {
          responseModalities: ['IMAGE'],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts) return null;

      for (const part of parts) {
        if (part.inlineData?.data) {
          return part.inlineData.data;
        }
      }

      functions.logger.warn('Slide image from brief: no inline image data in response.');
      return null;
    } catch (error) {
      functions.logger.warn(
        'Slide image from brief failed (non-fatal):',
        error
      );
      return null;
    }
  }

  public static async getModelInfo(): Promise<{
    available: boolean;
    model?: string;
    error?: string;
  }> {
    try {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return {
          available: false,
          error: 'Gemini API key not configured',
        };
      }

      // Test connectivity with a simple request
      const client = this.getClient();
      const response = await client.models.generateContent({
        model: GEMINI_PRO_MODEL,
        contents: 'Test',
      });

      if (response.text !== undefined) {
        return {
          available: true,
          model: GEMINI_PRO_MODEL,
        };
      } else {
        return {
          available: false,
          error: 'API test failed - no response',
        };
      }
    } catch (error) {
      functions.logger.error('Gemini API test failed:', error);
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
