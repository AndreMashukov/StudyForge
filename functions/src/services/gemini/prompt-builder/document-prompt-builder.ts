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

**User's Request:**
${userPrompt}`;
  }
}


