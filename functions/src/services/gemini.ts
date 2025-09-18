import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiQuizResponse, ScrapedContent } from "shared-types";
import * as functions from "firebase-functions";

/**
 * Gemini AI service for generating quizzes from content
 */

export class GeminiService {
  private static genAI: GoogleGenerativeAI | null = null;

  /**
   * Initialize Gemini AI with API key
   */
  private static getClient(): GoogleGenerativeAI {
    if (!this.genAI) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not set");
      }
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    return this.genAI;
  }

  /**
   * Generate quiz from scraped content using Gemini Pro
   */
  public static async generateQuiz(content: ScrapedContent): Promise<GeminiQuizResponse> {
    try {
      functions.logger.info(`Generating quiz for content: ${content.title}`);

      const genAI = this.getClient();
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const prompt = this.buildQuizPrompt(content);
      
      functions.logger.debug("Sending request to Gemini AI", { contentLength: content.content.length });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response
      const quizData = this.parseQuizResponse(text);
      
      functions.logger.info(`Successfully generated quiz with ${quizData.questions.length} questions`);
      
      return quizData;

    } catch (error) {
      functions.logger.error("Error generating quiz with Gemini AI:", error);
      throw new Error(`Failed to generate quiz: ${error}`);
    }
  }

  /**
   * Build the prompt for quiz generation
   */
  private static buildQuizPrompt(content: ScrapedContent): string {
    const prompt = `
You are an expert quiz creator. Generate a comprehensive multiple-choice quiz based on the following article content.

**ARTICLE TITLE:** ${content.title}
${content.author ? `**AUTHOR:** ${content.author}` : ""}

**ARTICLE CONTENT:**
${content.content}

**INSTRUCTIONS:**
1. Create 8-12 multiple-choice questions that test understanding of the key concepts, facts, and insights from the article
2. Each question should have exactly 4 answer options (A, B, C, D)
3. Only one option should be correct
4. Questions should vary in difficulty (some basic recall, some requiring deeper understanding)
5. Include questions about main ideas, supporting details, conclusions, and implications
6. Avoid overly specific details that aren't central to the article's main points
7. Make incorrect options plausible but clearly wrong to someone who understood the content
8. Provide a brief explanation for why the correct answer is right (optional but preferred)

**REQUIRED JSON FORMAT:**
{
  "title": "Quiz Title Based on Article",
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of why this answer is correct (optional)"
    }
  ]
}

**IMPORTANT:**
- Return ONLY valid JSON, no additional text or markdown formatting
- Ensure the JSON is properly formatted and parseable
- The correctAnswer field should be an integer (0, 1, 2, or 3) indicating the index of the correct option
- Make sure questions are clear, concise, and grammatically correct
- Ensure all options are roughly the same length and complexity

Generate the quiz now:`;

    return prompt;
  }

  /**
   * Parse the JSON response from Gemini AI
   */
  private static parseQuizResponse(responseText: string): GeminiQuizResponse {
    try {
      // Clean up the response text (remove any markdown formatting or extra text)
      let cleanText = responseText.trim();
      
      // Remove markdown code blocks if present
      cleanText = cleanText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      
      // Find JSON content between curly braces
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
      }

      const parsed = JSON.parse(cleanText);

      // Validate the structure
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
      });

      functions.logger.info(`Parsed quiz with ${parsed.questions.length} questions`);
      
      return parsed as GeminiQuizResponse;

    } catch (error) {
      functions.logger.error("Error parsing Gemini AI response:", { error, responseText });
      throw new Error(`Failed to parse quiz response: ${error}`);
    }
  }

  /**
   * Validate content is suitable for quiz generation
   */
  public static validateContentForQuiz(content: ScrapedContent): void {
    if (!content.content || content.content.trim().length === 0) {
      throw new Error("Content is empty or invalid");
    }

    if (content.wordCount < 20) {
      throw new Error("Content is too short for meaningful quiz generation (minimum 20 words)");
    }

    if (content.wordCount > 10000) {
      functions.logger.warn(`Content is very long (${content.wordCount} words). Quiz generation may take longer.`);
    }

    // Check if content is primarily meaningful text (not just navigation/ads)
    const meaningfulContentRatio = this.calculateMeaningfulContentRatio(content.content);
    if (meaningfulContentRatio < 0.7) {
      throw new Error("Content appears to be mostly navigation or advertisements, not suitable for quiz generation");
    }
  }

  /**
   * Calculate ratio of meaningful content vs noise
   */
  private static calculateMeaningfulContentRatio(content: string): number {
    const totalWords = content.split(/\s+/).length;
    
    // Common noise words/phrases that appear in navigation/ads
    const noisePatterns = [
      /\b(click here|read more|subscribe|sign up|login|register|advertisement|sponsored)\b/gi,
      /\b(menu|navigation|header|footer|sidebar|breadcrumb)\b/gi,
      /\b(cookies?|privacy policy|terms of service|contact us)\b/gi,
    ];

    let noiseWords = 0;
    noisePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        noiseWords += matches.length;
      }
    });

    return (totalWords - noiseWords) / totalWords;
  }

  /**
   * Get Gemini model information
   */
  public static async getModelInfo(): Promise<{ model: string; available: boolean }> {
    try {
      // Check if client can be initialized
      this.getClient();
      return {
        model: "gemini-1.5-pro",
        available: true,
      };
    } catch (error) {
      functions.logger.error("Gemini AI not available:", error);
      return {
        model: "gemini-1.5-pro",
        available: false,
      };
    }
  }
}