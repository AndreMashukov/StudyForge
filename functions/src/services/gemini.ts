import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiQuizResponse, ScrapedContent } from "../../libs/shared-types/src/index";
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
   * Includes fallback for local development in unsupported regions
   */
  public static async generateQuiz(content: ScrapedContent, additionalPrompt?: string): Promise<GeminiQuizResponse> {
    try {
      functions.logger.info(`Generating quiz for content: ${content.title}`);

      // Check if we're running in local emulator
      const isLocalEmulator = this.isRunningInEmulator();
      
      if (isLocalEmulator && this.shouldUseMockForLocal()) {
        functions.logger.info("Using mock quiz generation for local development (geographic restrictions)");
        return this.generateMockQuiz(content, additionalPrompt);
      }

      const genAI = this.getClient();
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const prompt = this.buildQuizPrompt(content, additionalPrompt);
      
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
      
      // If we get a geographic restriction error in local development, use mock
      if (this.isGeographicRestrictionError(error) && this.isRunningInEmulator()) {
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
        model: "gemini-1.5-pro",
        generationConfig: {
          temperature: 0.3,
          topP: 1,
          topK: 40,
          maxOutputTokens: 8192,
        },
      });

      const result = await model.generateContent(prompt);
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
   * Build the prompt for quiz generation
   */
  private static buildQuizPrompt(content: ScrapedContent, additionalPrompt?: string): string {
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
8. **MANDATORY**: Each question MUST include a brief explanation of why the correct answer is right

**ANSWER DISTRIBUTION RULES (CRITICAL):**

**1. Balanced Distribution Requirements**:
   - ✅ **ENSURE**: Each option (A, B, C, D) should be correct roughly equal times
   - ✅ **TARGET**: For 10 questions: each option correct 2-3 times
   - ✅ **TARGET**: For 8 questions: each option correct 2 times
   - ✅ **TARGET**: For 12 questions: each option correct 3 times

**2. Anti-Clustering Rules**:
   - ❌ **AVOID**: No more than 2 consecutive questions with same correct answer
   - ❌ **AVOID**: No single option being correct more than 40% of total questions
   - ❌ **AVOID**: Any option being correct less than 20% of total questions
   
**3. Quality Check Process**:
   - **Step 1**: After generating all questions, count correct answers by option
   - **Step 2**: If distribution is uneven (example: A-1, B-7, C-1, D-1), REBALANCE
   - **Step 3**: Redistribute by moving questions between options while maintaining answer accuracy
   - **Step 4**: Verify no more than 2 consecutive questions have same correct answer
   
**4. Example BAD Distribution** (to avoid):
   Question sequence: Q1-B, Q2-C, Q3-B, Q4-A, Q5-B, Q6-B, Q7-B, Q8-B, Q9-B, Q10-B
   Count: Option A: 1, Option B: 7, Option C: 1, Option D: 0
   
**5. Example GOOD Distribution** (target):
   Question sequence: Q1-A, Q2-C, Q3-B, Q4-D, Q5-A, Q6-C, Q7-B, Q8-D, Q9-A, Q10-C
   Count: Option A: 3, Option B: 2, Option C: 3, Option D: 2

**ADDITIONAL INSTRUCTIONS:**
${additionalPrompt ? `
**CUSTOM REQUIREMENTS FROM USER:**
${additionalPrompt}

Please incorporate these additional requirements into your quiz generation while following all the rules above.
` : ''}

**REQUIRED JSON FORMAT:**
{
  "title": "Quiz Title Based on Article",
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of why this answer is correct (MANDATORY)"
    }
  ]
}

**IMPORTANT:**
- Return ONLY valid JSON, no additional text or markdown formatting
- Ensure the JSON is properly formatted and parseable
- The correctAnswer field should be an integer (0, 1, 2, or 3) indicating the index of the correct option
- Make sure questions are clear, concise, and grammatically correct
- Ensure all options are roughly the same length and complexity
- **VERIFY** answer distribution follows the rules above before finalizing
- **MANDATORY**: Every question must have an explanation field

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
        
        // Validate mandatory explanation
        if (!question.explanation || typeof question.explanation !== "string" || question.explanation.trim().length === 0) {
          throw new Error(`Question ${index + 1} is missing required explanation`);
        }
      });

      // Validate answer distribution
      this.validateAnswerDistribution(parsed.questions as Array<{ correctAnswer: number }>);

      functions.logger.info(`Parsed quiz with ${parsed.questions.length} questions`);
      
      return parsed as GeminiQuizResponse;

    } catch (error) {
      functions.logger.error("Error parsing Gemini AI response:", { error, responseText });
      throw new Error(`Failed to parse quiz response: ${error}`);
    }
  }

  /**
   * Validate answer distribution follows the balanced distribution rules
   */
  private static validateAnswerDistribution(questions: Array<{ correctAnswer: number }>): void {
    const totalQuestions = questions.length;
    if (totalQuestions === 0) return;

    // Count occurrences of each correct answer option
    const answerCounts = [0, 0, 0, 0]; // A, B, C, D
    questions.forEach(q => {
      if (q.correctAnswer >= 0 && q.correctAnswer <= 3) {
        answerCounts[q.correctAnswer]++;
      }
    });

    // Calculate expected distribution
    const idealCount = totalQuestions / 4;
    const minCount = Math.floor(totalQuestions * 0.2); // 20% minimum
    const maxCount = Math.ceil(totalQuestions * 0.4);  // 40% maximum

    // Check distribution balance
    for (let i = 0; i < 4; i++) {
      const optionLetter = ['A', 'B', 'C', 'D'][i];
      if (answerCounts[i] < minCount) {
        functions.logger.warn(`Answer distribution warning: Option ${optionLetter} appears only ${answerCounts[i]} times (minimum: ${minCount})`);
      }
      if (answerCounts[i] > maxCount) {
        functions.logger.warn(`Answer distribution warning: Option ${optionLetter} appears ${answerCounts[i]} times (maximum: ${maxCount})`);
      }
    }

    // Check for consecutive patterns (no more than 2 in a row)
    for (let i = 0; i < questions.length - 2; i++) {
      if (questions[i].correctAnswer === questions[i + 1].correctAnswer && 
          questions[i + 1].correctAnswer === questions[i + 2].correctAnswer) {
        const optionLetter = ['A', 'B', 'C', 'D'][questions[i].correctAnswer];
        functions.logger.warn(`Answer clustering detected: Option ${optionLetter} appears 3 times consecutively at questions ${i + 1}-${i + 3}`);
      }
    }

    // Log distribution for debugging
    functions.logger.info('Answer distribution validation:', {
      totalQuestions,
      distribution: {
        A: answerCounts[0],
        B: answerCounts[1], 
        C: answerCounts[2],
        D: answerCounts[3]
      },
      idealCount: idealCount.toFixed(1)
    });
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
   * Check if we're running in the Firebase emulator
   */
  private static isRunningInEmulator(): boolean {
    return process.env.FUNCTIONS_EMULATOR === "true" || 
           process.env.FIREBASE_EMULATOR_HUB !== undefined ||
           process.env.GCLOUD_PROJECT === undefined;
  }

  /**
   * Check if we should use mock responses for local development
   */
  private static shouldUseMockForLocal(): boolean {
    // Use environment variable to control mock usage
    return process.env.USE_GEMINI_MOCK_LOCAL === "true" || 
           process.env.NX_ENVIRONMENT === "development";
  }

  /**
   * Check if the error is due to geographic restrictions
   */
  private static isGeographicRestrictionError(error: unknown): boolean {
    const errorMessage = (error as Error)?.message || String(error);
    return errorMessage.includes("User location is not supported for the API use") ||
           errorMessage.includes("GoogleGenerativeAI Error") && errorMessage.includes("400 Bad Request");
  }

  /**
   * Generate a mock quiz for local development
   */
  private static generateMockQuiz(content: ScrapedContent, additionalPrompt?: string): GeminiQuizResponse {
    functions.logger.info("Generating mock quiz for local development");
    
    const words = content.content.split(/\s+/).slice(0, 50); // Use first 50 words for variety
    const title = content.title || "Sample Article";
    
    // Create realistic mock questions based on content
    const mockQuestions = [
      {
        question: `What is the main topic of "${title}"?`,
        options: [
          words.slice(0, 3).join(" ") + " and related concepts",
          "Unrelated topic A",
          "Unrelated topic B", 
          "Unrelated topic C"
        ],
        correctAnswer: 0,
        explanation: "This question tests understanding of the main topic discussed in the article."
      },
      {
        question: `According to the article, which of the following is mentioned?`,
        options: [
          "Something not in the article",
          words.slice(5, 8).join(" "),
          "Another unrelated concept",
          "Yet another wrong option"
        ],
        correctAnswer: 1,
        explanation: "This tests specific details mentioned in the content."
      },
      {
        question: `What can be inferred from the article about ${words[10] || "the subject"}?`,
        options: [
          "Incorrect inference A",
          "Incorrect inference B",
          `It relates to ${words.slice(15, 18).join(" ")}`,
          "Incorrect inference C"
        ],
        correctAnswer: 2,
        explanation: "This tests reading comprehension and inference skills."
      },
      {
        question: `The article primarily focuses on which aspect?`,
        options: [
          `${words.slice(20, 23).join(" ")} concepts`,
          "Unrelated focus area",
          "Another wrong focus",
          "Different subject entirely"
        ],
        correctAnswer: 0,
        explanation: "This evaluates understanding of the article's primary focus."
      },
      {
        question: `Based on the content, what would be a logical conclusion?`,
        options: [
          "Illogical conclusion A",
          "Illogical conclusion B", 
          "Illogical conclusion C",
          `${words.slice(25, 30).join(" ")} represents key insights`
        ],
        correctAnswer: 3,
        explanation: "This tests analytical thinking based on the article content."
      }
    ];

    return {
      title: `Quiz: ${title} (Development Mode)`,
      questions: mockQuestions
    };
  }

  /**
   * Get Gemini model information
   */
  public static async getModelInfo(): Promise<{ model: string; available: boolean }> {
    try {
      // If running in emulator and geographic restrictions apply, report as available with mock
      if (this.isRunningInEmulator() && this.shouldUseMockForLocal()) {
        return {
          model: "gemini-1.5-pro (mock for local development)",
          available: true,
        };
      }

      // Check if client can be initialized
      this.getClient();
      return {
        model: "gemini-1.5-pro",
        available: true,
      };
    } catch (error) {
      functions.logger.error("Gemini AI not available:", error);
      
      // If it's a geographic restriction in emulator, we can still work with mock
      if (this.isGeographicRestrictionError(error) && this.isRunningInEmulator()) {
        return {
          model: "gemini-1.5-pro (mock fallback)",
          available: true,
        };
      }
      
      return {
        model: "gemini-1.5-pro",
        available: false,
      };
    }
  }
}