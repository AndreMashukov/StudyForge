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

    // If custom instructions are provided (from rules), prepend them
    if (context.customInstructions) {
      return `${context.customInstructions}\n\n${basePrompt}`;
    }

    return basePrompt;
  }
}