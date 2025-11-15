/* eslint-disable no-useless-escape */
import { ScrapedContent } from '@shared-types';

/**
 * Quiz Prompt Builder for Gemini AI
 * 
 * This module contains utilities to build optimized prompts for Gemini AI
 * quiz generation that minimize JSON parsing issues and improve response quality.
 */

export class QuizPromptBuilder {
  
  /**
   * Generate random correct answer indices for quiz questions
   * @param questionCount - Number of questions (max 30)
   * @returns Array of random indices (0-3) for correct answers
   */
  static generateRandomCorrectAnswers(questionCount: number): number[] {
    const maxQuestions = Math.min(questionCount, 30);
    const randomAnswers: number[] = [];
    
    for (let i = 0; i < maxQuestions; i++) {
      // Generate random number from 0 to 3 (4 answer options: A, B, C, D)
      const randomIndex = Math.floor(Math.random() * 4);
      randomAnswers.push(randomIndex);
    }
    
    return randomAnswers;
  }

  /**
   * Build the comprehensive prompt for quiz generation
   */
  static buildQuizPrompt(content: ScrapedContent, additionalPrompt?: string, randomCorrectAnswers: number[] = []): string {
    const basePrompt = this.getBaseInstructions();
    const contentSection = this.formatContentSection(content);
    const answerDistributionRules = this.getRandomAnswerDistributionRules(randomCorrectAnswers);
    const additionalSection = additionalPrompt ? this.formatAdditionalRequirements(additionalPrompt) : '';
    const jsonFormatRules = this.getJsonFormatRules();
    const exampleStructure = this.getExampleStructure();
    const finalInstructions = this.getFinalInstructions();

    return `${basePrompt}

${contentSection}

${answerDistributionRules}

${additionalSection}

${jsonFormatRules}

${exampleStructure}

${finalInstructions}`;
  }

  /**
   * Build a simple prompt for content generation (non-quiz)
   */
  static buildContentPrompt(prompt: string): string {
    return `${prompt}

**IMPORTANT**: Provide your response as clean, well-formatted text without any markdown code blocks or special formatting.`;
  }

  /**
   * Base instructions for quiz generation
   */
  private static getBaseInstructions(): string {
    return `You are an expert quiz creator. Generate a comprehensive multiple-choice quiz based on the following article content.`;
  }

  /**
   * Format the content section of the prompt
   */
  private static formatContentSection(content: ScrapedContent): string {
    return `**ARTICLE TITLE:** ${content.title}
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
7. **MANDATORY**: Each question MUST include a brief explanation of why the correct answer is right

**CRITICAL OPTION QUALITY REQUIREMENTS:**

**8. EQUAL LENGTH RULE (MANDATORY):**
   - ✅ **ALL four options must be approximately the same length (within 5-10 words of each other)**
   - ✅ **Count words in each option and balance them accordingly**
   - ❌ **NEVER make the correct answer significantly longer or shorter than others**
   - ❌ **AVOID: Short options mixed with very long explanatory options**
   
   **Example of GOOD balanced options:**
   A. The algorithm uses Floyd's cycle detection method
   B. The array elements represent linked list node pointers  
   C. The pigeonhole principle guarantees duplicate number existence
   D. The two-pointer technique identifies the cycle intersection
   
   **Example of BAD unbalanced options:**
   A. Positive integers
   B. Sorted array
   C. There are n+1 numbers in range [1,n], ensuring at least one duplicate according to pigeonhole principle
   D. Unique numbers

**9. PLAUSIBLE INCORRECT OPTIONS (MANDATORY):**
   - ✅ **All incorrect options must be topically relevant and contextually related**
   - ✅ **Use concepts, terminology, and ideas from the same domain/article**
   - ✅ **Make incorrect options sound reasonable to someone with partial knowledge**
   - ✅ **Base incorrect options on common misconceptions or related concepts**
   - ❌ **NEVER use completely unrelated or nonsensical options**
   - ❌ **AVOID: Generic options that don't relate to the specific question context**
   
   **Example of GOOD plausible incorrect options for algorithm question:**
   - All options discuss algorithm concepts, data structures, or computational principles
   - Each option uses domain-specific terminology appropriately
   - Incorrect options represent believable alternative explanations
   
   **Example of BAD irrelevant incorrect options:**
   - Mixing algorithm concepts with unrelated topics (like "to sort array" for cycle detection)
   - Using overly generic statements that could apply to anything
   - Including options that don't use relevant technical vocabulary

**10. OPTION CONSTRUCTION PROCESS:**
   **Step 1**: Write the correct answer with appropriate length and detail
   **Step 2**: Create 3 incorrect options using these strategies:
      - **Strategy A**: Take a related but incorrect concept from the article
      - **Strategy B**: Use a common misconception about the topic
      - **Strategy C**: Apply the same technical domain but wrong context/application
   **Step 3**: Ensure all 4 options are similar in word count and structure
   **Step 4**: Verify incorrect options sound plausible but are clearly wrong to knowledgeable readers`;
  }

  /**
   * Generate random answer distribution rules with specific pattern
   * @param randomAnswers - Array of random correct answer indices (0-3)
   */
  private static getRandomAnswerDistributionRules(randomAnswers: number[]): string {
    // Convert indices to letter options (0 -> A, 1 -> B, 2 -> C, 3 -> D)
    const answerLetters = randomAnswers.map(index => String.fromCharCode(65 + index)); // 65 is 'A'
    
    // Format the answer sequence
    const answerSequence = answerLetters.map((letter, idx) => `Q${idx + 1}-${letter}`).join(', ');
    
    return `**ANSWER DISTRIBUTION RULES (CRITICAL):**

**MANDATORY CORRECT ANSWER PATTERN:**
You MUST use the following pre-determined pattern for correct answers to ensure random distribution:

${answerSequence}

**INSTRUCTIONS:**
- For Question 1, make option ${answerLetters[0]} the correct answer
- For Question 2, make option ${answerLetters[1]} the correct answer
- For Question 3, make option ${answerLetters[2]} the correct answer
${randomAnswers.length > 3 ? `- For Question 4, make option ${answerLetters[3]} the correct answer` : ''}
${randomAnswers.length > 4 ? `- Continue following the pattern above for all ${randomAnswers.length} questions` : ''}

**IMPLEMENTATION PROCESS:**
1. **Generate the question content** first (question text, all 4 options, explanation)
2. **Identify which option should be correct** based on the pattern above (e.g., if pattern says "Q1-B", then option B must be correct)
3. **Ensure the content of that designated option is factually correct** and the other 3 options are plausible but incorrect
4. **Set the correctAnswer field** to match the pattern (0=A, 1=B, 2=C, 3=D)

**CRITICAL:** You MUST follow this exact pattern. This pattern has been randomly generated to ensure fair distribution of correct answers across all options.`;
  }


  /**
   * Format additional user requirements
   */
  private static formatAdditionalRequirements(additionalPrompt: string): string {
    return `**ADDITIONAL INSTRUCTIONS:**
**CUSTOM REQUIREMENTS FROM USER:**
${additionalPrompt}

Please incorporate these additional requirements into your quiz generation while following all the rules above.`;
  }

  /**
   * Critical JSON formatting rules
   */
  private static getJsonFormatRules(): string {
    return `**CRITICAL JSON FORMATTING RULES:**
- Return ONLY valid JSON, no additional text or markdown formatting
- Ensure the JSON is properly formatted and parseable
- **ALL string values MUST be wrapped in double quotes**
- **NEVER use unquoted text in JSON**
- **NEVER use double quotes (") inside JSON string values**
- **NEVER use backticks inside JSON string values**
- **NEVER use escaped quotes (\") inside JSON string values**

**ARRAY VALUES - CRITICAL:**
- ❌ WRONG: ["Option 1", Send(), "Option 3"] (unquoted function name)
- ❌ WRONG: ["Option 1", Some Value, "Option 3"] (unquoted text)
- ✅ CORRECT: ["Option 1", "Send()", "Option 3"] (all quoted)
- ✅ CORRECT: ["Option 1", "Some Value", "Option 3"] (all quoted)

**FOR CODE/FUNCTION REFERENCES - USE THESE ALTERNATIVES:**
- ❌ WRONG: "What does the \"GetUser()\" function do?"
- ❌ WRONG: "The \"main\" function handles..."  
- ❌ WRONG: "What is the purpose of the \`setTimeout\` method?"
- ✅ CORRECT: "What does the GetUser() function do?"
- ✅ CORRECT: "The main function handles..."
- ✅ CORRECT: "What is the purpose of the setTimeout method?"
- ✅ CORRECT: "What does the user retrieval function do?"
- ✅ CORRECT: "The primary function handles..."

**OPTION QUALITY VALIDATION CHECKLIST (MANDATORY):**
Before finalizing JSON, verify each question meets these requirements:

**✅ LENGTH CHECK:**
- Count words in each option: [A: X words, B: Y words, C: Z words, D: W words]
- Ensure difference between longest and shortest option is ≤ 10 words
- If imbalanced, rephrase options to achieve similar lengths

**✅ RELEVANCE CHECK:**
- All incorrect options use terminology from the article/domain
- No generic or completely unrelated options
- Each incorrect option represents a plausible alternative explanation

**✅ QUALITY EXAMPLES:**

**GOOD Option Set:**
"options": [
  "The algorithm employs Floyd's cycle detection for duplicate identification",
  "The pigeonhole principle guarantees existence of duplicate values systematically", 
  "The array structure creates implicit linked list representation naturally",
  "The two-phase approach enables efficient O(1) space complexity solution"
]

**BAD Option Set to AVOID:**
"options": [
  "Yes",
  "Because there are n+1 numbers in the range [1,n], ensuring at least one number appears twice according to the pigeonhole principle which is a fundamental mathematical concept",
  "No", 
  "To sort the array"
]

**OTHER FORMATTING RULES:**
- All JSON string values must be wrapped in double quotes, including option text
- **ENSURE COMMAS**: Every object in arrays must be separated by commas
- **ENSURE COMMAS**: Every string in arrays must be separated by commas
- The correctAnswer field should be an integer (0, 1, 2, or 3) indicating the index of the correct option
- Make sure questions are clear, concise, and grammatically correct
- **VERIFY** answer distribution follows the rules above before finalizing
- **MANDATORY**: Every question must have an explanation field`;
  }

  /**
   * Example JSON structure
   */
  private static getExampleStructure(): string {
    return `**REQUIRED JSON FORMAT:**
{
  "title": "Quiz Title Based on Article",
  "questions": [
    {
      "question": "Question text here?",
      "options": [
        "Option A with approximately equal length and relevant content",
        "Option B with similar length and plausible alternative explanation", 
        "Option C maintaining consistent length with topically relevant information",
        "Option D providing comparable length with contextually appropriate details"
      ],
      "correctAnswer": 0,
      "explanation": "Brief explanation of why this answer is correct (MANDATORY)"
    }
  ]
}

**EXAMPLE OF WELL-BALANCED OPTIONS:**
{
  "question": "What fundamental principle ensures that the duplicate detection algorithm will always find a cycle?",
  "options": [
    "The pigeonhole principle guarantees duplicate existence in constrained ranges",
    "The array traversal pattern creates deterministic cycle formation naturally", 
    "The mathematical properties ensure convergence through iterative pointer movement",
    "The algorithmic complexity bounds require cycle detection for optimal performance"
  ],
  "correctAnswer": 0,
  "explanation": "The pigeonhole principle states that with n+1 items in n containers, at least one container must contain multiple items"
}`;
  }

  /**
   * Final instructions and generation command
   */
  private static getFinalInstructions(): string {
    return `**IMPORTANT:**
- **CRITICAL**: Do NOT use backticks anywhere in the JSON - use plain text instead
- **FOR CODE REFERENCES**: Write code as plain text without backticks or quotes
- Example: "The server.go file" NOT "The server.go file with backticks" or "The server.go file with quotes"
- **ENSURE COMMAS**: Every object in arrays must be separated by commas
- **ENSURE COMMAS**: Every string in arrays must be separated by commas

**FINAL QUALITY CHECKLIST - COMPLETE BEFORE SUBMITTING:**

1. **OPTION LENGTH VERIFICATION:**
   - Count words in each option set
   - Ensure all options in each question are within 5-10 words of each other
   - Rephrase if any option is significantly longer/shorter

2. **OPTION RELEVANCE VERIFICATION:**
   - Check that ALL incorrect options relate to the article topic
   - Ensure incorrect options use appropriate technical terminology
   - Verify no generic or nonsensical options exist

3. **ANSWER DISTRIBUTION VERIFICATION:**
   - Count correct answers per option (A, B, C, D)
   - Ensure roughly equal distribution
   - Check for clustering (no more than 2 consecutive same answers)

4. **EXPLANATION QUALITY VERIFICATION:**
   - Every question has detailed explanation
   - Explanations clarify why correct answer is right
   - Explanations help distinguish from incorrect options

**REMEMBER:** A well-crafted quiz question should be answerable by someone knowledgeable but not easily guessed through option length or relevance disparities.

Generate the quiz now:`;
  }
}