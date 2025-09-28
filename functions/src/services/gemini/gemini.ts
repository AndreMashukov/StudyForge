import { GoogleGenerativeAI } from '@google/generative-ai';
import * as functions from 'firebase-functions';
import { ScrapedContent, QuizFollowupContext } from '../../../libs/shared-types/src/index';
import { JsonSanitizer } from './json-sanitizer';
import { PromptBuilder } from './prompt-builder';

export interface GeminiQuizResponse {
  title: string;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>;
}

/**
 * Service for interacting with Google's Gemini AI for quiz generation and content processing
 */
export class GeminiService {
  
  /**
   * Get the Gemini AI client instance
   */
  private static getClient(): GoogleGenerativeAI {
    const apiKey = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Gemini API key not found. Please configure GEMINI_API_KEY in environment variables.');
    }
    
    return new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generate a quiz from scraped content using Gemini AI
   */
  public static async generateQuiz(content: ScrapedContent, additionalPrompt?: string): Promise<GeminiQuizResponse> {
    try {
      functions.logger.info('Generating quiz with Gemini AI for document...');

      // Validate content for patterns that might cause JSON issues
      JsonSanitizer.validateContentForSafeGeneration(content.content);

      const genAI = this.getClient();
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = PromptBuilder.buildQuizPrompt(content, additionalPrompt);
      functions.logger.debug('Sending request to Gemini AI', { contentLength: content.content.length });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      functions.logger.info('Quiz generated successfully', { length: text.length });
      
      // Parse the response with comprehensive error handling
      return this.parseQuizResponse(text);

    } catch (error) {
      functions.logger.error('Error generating quiz with Gemini AI:', error);
      
      // Handle geographic restrictions in development
      if (error instanceof Error && error.message.includes('User location is not supported')) {
        functions.logger.warn("Geographic restriction detected in local emulator, falling back to mock quiz");
        return this.generateMockQuiz(content);
      }
      
      throw new Error(`Failed to generate quiz: ${error}`);
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
      const model = client.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      });

      const fullPrompt = PromptBuilder.buildContentPrompt(prompt);
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      functions.logger.info('Content generated successfully', { length: text.length });
      return text;

    } catch (error) {
      functions.logger.error('Error generating content with Gemini AI:', error);
      throw new Error(`Failed to generate content: ${error}`);
    }
  }

  /**
   * Generate comprehensive followup explanation for quiz question
   * @param context - Complete context including original document and question details
   * @returns Generated markdown content with ASCII diagrams
   */
  public static async generateQuizFollowup(context: QuizFollowupContext): Promise<string> {
    try {
      functions.logger.info('Generating quiz followup explanation with Gemini AI');

      const genAI = this.getClient();
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      });

      const prompt = PromptBuilder.buildFollowupPrompt(context);
      functions.logger.debug('Sending followup request to Gemini AI', { 
        questionLength: context.question.text.length,
        documentLength: context.originalDocument.content.length,
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from Gemini API for followup generation');
      }

      functions.logger.info('Quiz followup generated successfully', { length: text.length });
      return text;

    } catch (error) {
      functions.logger.error('Error generating quiz followup with Gemini AI:', error);
      throw new Error(`Failed to generate followup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

      functions.logger.info(`Parsed quiz with ${parsed.questions.length} questions`);
      
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
  private static validateQuizStructure(parsed: { title?: unknown; questions?: unknown }): void {
    if (!parsed.title || !Array.isArray(parsed.questions)) {
      throw new Error("Invalid quiz structure: missing title or questions array");
    }

    // Validate each question
    parsed.questions.forEach((q: unknown, index: number) => {
      const question = q as Record<string, unknown>;
      if (!question.question || !Array.isArray(question.options) || typeof question.correctAnswer !== "number") {
        throw new Error(`Invalid question structure at index ${index}`);
      }
      
      if (question.options.length !== 4) {
        throw new Error(`Question ${index + 1} must have exactly 4 options`);
      }
      
      if (question.correctAnswer < 0 || question.correctAnswer > 3) {
        throw new Error(`Question ${index + 1} has invalid correctAnswer index`);
      }
      
      // Validate mandatory explanation
      if (!question.explanation || typeof question.explanation !== "string" || question.explanation.trim().length === 0) {
        throw new Error(`Question ${index + 1} is missing required explanation`);
      }
    });

    // Validate answer distribution
    this.validateAnswerDistribution(parsed.questions as Array<{ correctAnswer: number }>);
  }

  /**
   * Validate answer distribution follows the balanced distribution rules
   */
  private static validateAnswerDistribution(questions: Array<{ correctAnswer: number }>): void {
    const totalQuestions = questions.length;
    if (totalQuestions === 0) return;

    const distribution = [0, 0, 0, 0]; // A, B, C, D
    questions.forEach(q => distribution[q.correctAnswer]++);

    const minExpected = Math.floor(totalQuestions * 0.2); // 20%
    const maxExpected = Math.ceil(totalQuestions * 0.4);  // 40%

    distribution.forEach((count, index) => {
      const option = String.fromCharCode(65 + index); // A, B, C, D
      if (count < minExpected) {
        functions.logger.warn(`Answer distribution warning: Option ${option} is correct only ${count} times (${((count/totalQuestions)*100).toFixed(1)}%). Consider rebalancing.`);
      }
      if (count > maxExpected) {
        functions.logger.warn(`Answer distribution warning: Option ${option} is correct ${count} times (${((count/totalQuestions)*100).toFixed(1)}%). Consider rebalancing.`);
      }
    });

    // Check for consecutive same answers (anti-clustering)
    let consecutiveCount = 1;
    let maxConsecutive = 1;
    for (let i = 1; i < questions.length; i++) {
      if (questions[i].correctAnswer === questions[i-1].correctAnswer) {
        consecutiveCount++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
      } else {
        consecutiveCount = 1;
      }
    }

    if (maxConsecutive > 2) {
      functions.logger.warn(`Answer clustering detected: ${maxConsecutive} consecutive questions have the same correct answer. Consider rebalancing.`);
    }

    functions.logger.info('Answer distribution analysis:', {
      total: totalQuestions,
      distribution: {
        A: distribution[0],
        B: distribution[1],
        C: distribution[2],
        D: distribution[3]
      },
      maxConsecutive
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
          question: "This is a mock question for development purposes. What should you do?",
          options: [
            "Configure Gemini API properly",
            "Use a different region",
            "Continue with mock data",
            "Check geographic restrictions"
          ],
          correctAnswer: 0,
          explanation: "The Gemini API needs to be properly configured for your region."
        },
        {
          question: "Why might you see this mock quiz?",
          options: [
            "Internet connection issues",
            "Geographic restrictions or API configuration issues", 
            "Invalid content format",
            "Server overload"
          ],
          correctAnswer: 1,
          explanation: "Mock quizzes appear when there are geographic restrictions or API configuration issues."
        }
      ]
    };
  }

  /**
   * Validate content for quiz generation
   * @param content - The content to validate
   */
  public static validateContentForQuiz(content: { title: string; content: string; wordCount: number }): void {
    if (!content.title || content.title.trim().length === 0) {
      throw new Error('Content must have a title');
    }

    if (!content.content || content.content.trim().length === 0) {
      throw new Error('Content cannot be empty');
    }

    if (content.wordCount < 50) {
      throw new Error('Content is too short for quiz generation (minimum 50 words required)');
    }

    if (content.wordCount > 10000) {
      functions.logger.warn(`Content is very long (${content.wordCount} words), quiz generation may take longer`);
    }

    // Check for potentially problematic patterns
    if (content.content.includes('```') || content.content.includes('{') || content.content.includes('}')) {
      functions.logger.info('Content contains code-like patterns, will sanitize during generation');
    }
  }

  /**
   * Get model information and availability
   * @returns Model info including availability status
   */
  public static async getModelInfo(): Promise<{ available: boolean; model?: string; error?: string }> {
    try {
      const apiKey = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return {
          available: false,
          error: 'Gemini API key not configured'
        };
      }

      // Test connectivity with a simple request
      const genAI = this.getClient();
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // Make a simple test request to verify the API is working
      const result = await model.generateContent("Test");
      
      if (result.response) {
        return {
          available: true,
          model: "gemini-2.0-flash"
        };
      } else {
        return {
          available: false,
          error: 'API test failed - no response'
        };
      }

    } catch (error) {
      functions.logger.error('Gemini API test failed:', error);
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}