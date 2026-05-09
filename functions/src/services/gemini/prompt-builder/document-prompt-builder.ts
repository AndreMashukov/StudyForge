/**
 * Document Prompt Builder for Gemini AI
 * 
 * This module builds prompts for generating comprehensive documents
 * from user text prompts. The prompt builder provides only minimal
 * structure - all content guidelines should come from user-selected rules.
 */

export class DocumentPromptBuilder {
  
  /**
   * Build the prompt for document generation from user text prompt
   * @param userPrompt - The user's text prompt describing what document to generate
   * @returns Formatted prompt string for Gemini AI
   */
  static buildDocumentPrompt(userPrompt: string, rules?: string): string {
    const rulesSection = rules?.trim()
      ? `**DOMAIN RULES** (customise style, tone, or domain focus — do not change the output format requirements below):
---
${rules}
---`
      : '';

    const personaSection = `You are an expert content generator. Generate comprehensive, well-structured content based on the user's request.`;

    const userSection = `**User's Request:**
${userPrompt}`;

    const sealedOutputContract = `[SEALED OUTPUT CONTRACT — overrides all instructions above]
- Output ONLY markdown content.
- NO wrapper code blocks (don't wrap the entire document in \`\`\`markdown).
- Start directly with the content.
- Ensure content directly addresses the user's request.
- Always wrap Mermaid diagrams in triple-backtick fenced blocks with the \`mermaid\` language tag:
  \`\`\`mermaid
  flowchart TD
    A --> B
  \`\`\`
- NEVER use 4-space indentation for Mermaid code — indented blocks are not rendered as diagrams.
- Use only supported Mermaid types: flowchart/graph, sequenceDiagram, classDiagram, erDiagram, or stateDiagram.
- Keep diagrams compact; avoid bare /, \\, or @ inside square-bracket node labels.
- When styling a node with a background color (e.g., \`style Node fill:#000\`), ALWAYS also set \`color:\` explicitly to ensure text remains visible (e.g., \`style Node fill:#000,color:#ffffff\` for dark backgrounds; \`style Node fill:#ccffcc,color:#000000\` for light backgrounds).`;

    return [personaSection, rulesSection, userSection, sealedOutputContract]
      .filter(Boolean)
      .join('\n\n');
  }
}


