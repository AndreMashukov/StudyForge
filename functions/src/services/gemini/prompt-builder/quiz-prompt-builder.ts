/* eslint-disable no-useless-escape */
import { ScrapedContent } from '../../../../libs/shared-types/src/index';

/**
 * Quiz Prompt Builder for Gemini AI
 * 
 * This module contains utilities to build optimized prompts for Gemini AI
 * quiz generation that minimize JSON parsing issues and improve response quality.
 */

export class QuizPromptBuilder {
  
  /**
   * Build the comprehensive prompt for quiz generation
   */
  static buildQuizPrompt(content: ScrapedContent, additionalPrompt?: string): string {
    const basePrompt = this.getBaseInstructions();
    const contentSection = this.formatContentSection(content);
    const answerDistributionRules = this.getAnswerDistributionRules();
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
   * Answer distribution rules to ensure balanced quizzes
   */
  private static getAnswerDistributionRules(): string {
    return `**ANSWER DISTRIBUTION RULES (CRITICAL):**

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
   Count: Option A: 3, Option B: 2, Option C: 3, Option D: 2`;
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