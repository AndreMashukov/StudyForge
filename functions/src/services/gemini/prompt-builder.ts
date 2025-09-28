/* eslint-disable no-useless-escape */
import { ScrapedContent, QuizFollowupContext } from '../../../libs/shared-types/src/index';

/**
 * Prompt Builder for Gemini AI Quiz Generation
 * 
 * This module contains utilities to build optimized prompts for Gemini AI
 * that minimize JSON parsing issues and improve response quality.
 */

export class PromptBuilder {
  
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
7. Make incorrect options plausible but clearly wrong to someone who understood the content
8. **MANDATORY**: Each question MUST include a brief explanation of why the correct answer is right`;
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

**OTHER FORMATTING RULES:**
- All JSON string values must be wrapped in double quotes, including option text
- **ENSURE COMMAS**: Every object in arrays must be separated by commas
- **ENSURE COMMAS**: Every string in arrays must be separated by commas
- The correctAnswer field should be an integer (0, 1, 2, or 3) indicating the index of the correct option
- Make sure questions are clear, concise, and grammatically correct
- Ensure all options are roughly the same length and complexity
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
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of why this answer is correct (MANDATORY)"
    }
  ]
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

Generate the quiz now:`;
  }

  /**
   * Build a simple prompt for content generation (non-quiz)
   */
  static buildContentPrompt(prompt: string): string {
    return `${prompt}

**IMPORTANT**: Provide your response as clean, well-formatted text without any markdown code blocks or special formatting.`;
  }

  /**
   * Build comprehensive followup explanation prompt
   */
  static buildFollowupPrompt(context: QuizFollowupContext): string {
    return `You are an expert educator creating comprehensive followup explanations for quiz questions. 

ORIGINAL DOCUMENT CONTEXT:
Title: "${context.originalDocument.title}"
Content: 
${context.originalDocument.content}

QUIZ CONTEXT:
Quiz Title: "${context.quiz.title}"
Question: "${context.question.text}"
Available Options: ${context.question.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}
User's Answer: "${context.question.userAnswer}"
${context.question.correctAnswer ? `Correct Answer: "${context.question.correctAnswer}"` : ''}

TASK:
Generate a comprehensive educational explanation in markdown format that:

1. **Explains the core concept** being tested in the question
2. **Provides detailed analysis** of why each answer option is correct/incorrect
3. **Includes exactly 2 ASCII diagrams**:
   - Diagram 1: Conceptual overview showing the main concept visually
   - Diagram 2: Detailed process/implementation showing step-by-step breakdown
4. **Connects to the original document** by referencing specific sections
5. **Offers practical insights** and memory aids for understanding

CRITICAL FORMATTING REQUIREMENTS:
- Use proper markdown structure with clear headings
- **MANDATORY**: Each ASCII diagram MUST be wrapped in triple backticks
- **EXAMPLE OF CORRECT FORMAT**:
  ## Diagram 1: Title
  
  Triple backticks here
  ╔═══════════════╗     ┌─────────────┐
  ║ Important Box ║ ──→ │ Process Box │
  ╚═══════════════╝     └─────────────┘
  Triple backticks here
  
  This diagram shows...
- Never put ASCII diagrams outside code blocks
- Follow the ascii-diagram-rule patterns for visual clarity
- Create educational content suitable for deep learning

ASCII DIAGRAM REQUIREMENTS:
- **CRITICAL**: Always wrap ASCII diagrams in \`\`\` code blocks
- Use boxes, arrows, and symbols: → ↑ ↓ ← ✅ ❌ ⚠️ 🔄 ⭐
- Make diagrams informative and easy to understand  
- Explain each diagram after showing it in regular text
- Ensure diagrams complement the textual explanation
- Keep diagrams concise but informative

AVAILABLE ASCII SYMBOLS:
\`\`\`
╔═══════════════╗     ┌─────────────┐     +-------------+
║ Important Box ║     │ Regular Box │     | Simple Box  |
╚═══════════════╝     └─────────────┘     +-------------+

Flow Examples:
Process A ──→ Process B ──→ Result
    │              ↑
    └──→ Alt Path ──┘

Symbols: ✅ ❌ ⚠️ 🔄 ⭐ → ↑ ↓ ← │ ─ ╔ ╗ ╚ ╝ ║ ═
\`\`\`

CONTENT STRUCTURE:
1. **# Question Analysis**
2. **## Core Concept Explanation**  
3. **## Answer Analysis**
4. **## Diagram 1: Conceptual Overview**
   **CRITICAL**: Must wrap ASCII art in triple backticks like this:
   Triple backticks on line before diagram
   ASCII diagram content here
   Triple backticks on line after diagram
5. **## Diagram 2: Detailed Process**
   **CRITICAL**: Must wrap ASCII art in triple backticks like this:
   Triple backticks on line before diagram
   ASCII diagram content here
   Triple backticks on line after diagram
6. **## Key Takeaways**
7. **## Connection to Original Document**

**FINAL REMINDER**: 
- EVERY ASCII diagram must be wrapped in triple backticks (code blocks)
- No exceptions - all ASCII art must be in code blocks
- Text explanation goes outside code blocks
- This is critical for proper markdown rendering

Generate comprehensive, educational markdown content that helps the learner deeply understand the topic.`;
  }
}