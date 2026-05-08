import { QuizFollowupContext } from '@shared-types';

/**
 * Followup Prompt Builder for Gemini AI
 * 
 * This module contains utilities to build optimized prompts for Gemini AI
 * to generate comprehensive educational explanations for quiz questions.
 */

export class FollowupPromptBuilder {
  
  /**
   * Build comprehensive followup explanation prompt
   */
  static buildFollowupPrompt(context: QuizFollowupContext): string {
    if (context.question.questionType === 'sequence') {
      return this.buildSequenceFollowupPrompt(context);
    }

    // Base prompt components
    const basePrompt = `You are an expert educator creating comprehensive followup explanations for quiz questions. 

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
3. **Includes exactly 2 Mermaid diagrams**:
   - Diagram 1: Conceptual overview showing the main concept visually
   - Diagram 2: Detailed process/implementation showing step-by-step breakdown
4. **Connects to the original document** by referencing specific sections
5. **Offers practical insights** and memory aids for understanding

CRITICAL FORMATTING REQUIREMENTS:
- Use proper markdown structure with clear headings
- **MANDATORY**: Each Mermaid diagram MUST be wrapped in \`\`\`mermaid code fences
- **EXAMPLE OF CORRECT FORMAT**:
  ## Diagram 1: Title
  
  \`\`\`mermaid
  flowchart TD
   A[Core Concept] --> B[Important Step]
   B --> C[Outcome]
  \`\`\`
  
  This diagram shows...
- Never put Mermaid diagrams outside \`\`\`mermaid code fences
- Use only supported Mermaid types: flowchart/graph, sequenceDiagram, classDiagram, erDiagram, or stateDiagram
- Keep diagrams compact and visually clear
- Do not use bare /, \\, or @ inside square-bracket node labels
- If a label needs a special character, quote the label inside the brackets
- Use subgraph IDs without spaces; put the display label in quotes if needed
- Create educational content suitable for deep learning

MERMAID DIAGRAM REQUIREMENTS:
- **CRITICAL**: Always wrap Mermaid diagrams in \`\`\`mermaid code fences
- When styling a node with a background color, ALWAYS also set \`color:\` explicitly to ensure text remains visible (e.g., \`style Node fill:#000,color:#ffffff\` for dark; \`style Node fill:#ccffcc,color:#000000\` for light backgrounds)
- Explain each diagram after showing it in regular text
- Ensure diagrams complement the textual explanation
- Keep diagrams concise but informative
- Prefer flowchart/graph unless another supported Mermaid type is clearly better

CONTENT STRUCTURE:
1. **# Question Analysis**
2. **## Core Concept Explanation**  
3. **## Answer Analysis**
4. **## Diagram 1: Conceptual Overview**
  **CRITICAL**: Must wrap Mermaid source in \`\`\`mermaid fences
5. **## Diagram 2: Detailed Process**
  **CRITICAL**: Must wrap Mermaid source in \`\`\`mermaid fences
6. **## Key Takeaways**
7. **## Connection to Original Document**

**FINAL REMINDER**: 
- EVERY Mermaid diagram must be wrapped in \`\`\`mermaid fences
- No exceptions - all Mermaid diagrams must be in Mermaid code blocks
- Text explanation goes outside code blocks
- This is critical for proper markdown rendering

Generate comprehensive, educational markdown content that helps the learner deeply understand the topic.`;

    // If custom instructions are provided (from rules), prepend them.
    // The base prompt's MANDATORY Mermaid fence requirement takes precedence
    // over any rule instruction that might say to indent Mermaid blocks.
    if (context.customInstructions) {
      return `${context.customInstructions}\n\n${basePrompt}`;
    }

    return basePrompt;
  }

  private static buildSequenceFollowupPrompt(context: QuizFollowupContext): string {
    const userSequence = context.question.userSequence ?? [];
    const correctSequence = context.question.correctSequence ?? [];
    const availableItems = context.question.sequenceItems ?? correctSequence;

    const basePrompt = `You are an expert educator creating comprehensive followup explanations for sequence ordering quiz questions.

ORIGINAL DOCUMENT CONTEXT:
Title: "${context.originalDocument.title}"
Content:
${context.originalDocument.content}

QUIZ CONTEXT:
Quiz Title: "${context.quiz.title}"
Question: "${context.question.text}"
Available Sequence Items:
${availableItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}
Learner's Submitted Order:
${userSequence.map((item, i) => `${i + 1}. ${item}`).join('\n')}
Correct Order:
${correctSequence.map((item, i) => `${i + 1}. ${item}`).join('\n')}
${context.question.correctAnswer ? `Original concise explanation: "${context.question.correctAnswer}"` : ''}

TASK:
Generate a comprehensive educational explanation in markdown format that:

1. **Explains the underlying sequence or process** being tested
2. **Compares the learner's submitted order with the correct order**, calling out exactly where the ordering first diverges
3. **Explains why each item belongs in its correct position** and what depends on what
4. **Includes exactly 2 Mermaid diagrams**:
   - Diagram 1: A compact flowchart showing the correct sequence
   - Diagram 2: A comparison or dependency diagram that helps the learner understand why the order matters
5. **Connects to the original document** by referencing specific ideas or sections
6. **Offers practical memory aids** for reconstructing the order next time

CRITICAL FORMATTING REQUIREMENTS:
- Use proper markdown structure with clear headings
- **MANDATORY**: Each Mermaid diagram MUST be wrapped in \`\`\`mermaid code fences
- Prefer flowchart/graph diagrams for sequence explanations unless another supported Mermaid type is clearly better
- Keep diagram labels concise and safe for Mermaid parsing
- Do not use bare /, \\, or @ inside square-bracket node labels
- If a label needs a special character, quote the label inside the brackets
- Use subgraph IDs without spaces; put the display label in quotes if needed

CONTENT STRUCTURE:
1. **# Sequence Analysis**
2. **## Core Concept Explanation**
3. **## Order Comparison**
4. **## Why This Order Works**
5. **## Diagram 1: Correct Sequence**
   **CRITICAL**: Must wrap Mermaid source in \`\`\`mermaid fences
6. **## Diagram 2: Dependency View**
   **CRITICAL**: Must wrap Mermaid source in \`\`\`mermaid fences
7. **## Key Takeaways**
8. **## Connection to Original Document**

Generate comprehensive, educational markdown content that helps the learner understand both the correct answer and the reasoning behind the order.`;

    if (context.customInstructions) {
      return `${context.customInstructions}\n\n${basePrompt}`;
    }

    return basePrompt;
  }
}
