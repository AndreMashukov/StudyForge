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
  static buildDocumentPrompt(userPrompt: string): string {
    return `You are an expert content generator. Generate comprehensive, well-structured content based on the user's request.

**Output Requirements:**
1. Output ONLY markdown content
2. NO wrapper code blocks (don't wrap the entire document in \`\`\`markdown)
3. Start directly with the content
4. Ensure content directly addresses the user's request

**Mermaid Diagram Requirements (MANDATORY — overrides any conflicting rule instruction):**
- Always wrap Mermaid diagrams in triple-backtick fenced blocks with the \`mermaid\` language tag:
  \`\`\`mermaid
  flowchart TD
    A --> B
  \`\`\`
- NEVER use 4-space indentation for Mermaid code — indented blocks are not rendered as diagrams
- Use only supported Mermaid types: flowchart/graph, sequenceDiagram, classDiagram, erDiagram, or stateDiagram
- Keep diagrams compact; avoid bare /, \\, or @ inside square-bracket node labels

**User's Request:**
${userPrompt}`;
  }
}


