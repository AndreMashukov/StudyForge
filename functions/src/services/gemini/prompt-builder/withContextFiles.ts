/**
 * Prompt Builder for Document Generation with Context Files
 * 
 * This module constructs structured prompts using Option C (Full Prompt Engineering)
 * approach for generating educational content with reference documents.
 */

import { IFileContent } from '../../../../libs/shared-types/src/index';

/**
 * Build comprehensive document generation prompt with context files
 * Uses Option C structure for best AI output quality
 * 
 * @param userPrompt - The user's text prompt describing what to generate
 * @param files - Optional array of reference documents to use as context
 * @returns Structured prompt optimized for educational content generation
 */
export function buildPromptWithContextFiles(
  userPrompt: string,
  files?: IFileContent[]
): string {
  // If no files provided, use the standard document prompt
  if (!files || files.length === 0) {
    return buildStandardDocumentPrompt(userPrompt);
  }

  // Build the full Option C structured prompt
  const prompt = `You are an expert educational content creator specializing in comprehensive learning materials. Use the provided reference documents to create detailed, accurate educational content.

=== REFERENCE DOCUMENTS ===

${buildReferenceDocumentsSection(files)}

=== TASK ===
${userPrompt.trim()}

=== GENERATION GUIDELINES ===
- Synthesize information from all reference documents above
- Create comprehensive content with proper structure (minimum 1000 words)
- Include tables, diagrams (using mermaid/ASCII), and examples where appropriate
- Ensure accuracy by referencing the provided context
- Maintain educational tone with clear explanations
- Organize content with proper headings and sections
- Start with a clear H1 title (# Title)
- Include these sections: Glossary, Core Concepts, Examples, Summary
- Use markdown formatting throughout
- Add relevant ASCII diagrams in code blocks for visual explanations

Generate the complete educational document now:`;

  return prompt;
}

/**
 * Build the reference documents section
 * @param files - Array of reference documents
 * @returns Formatted reference documents section
 */
function buildReferenceDocumentsSection(files: IFileContent[]): string {
  return files
    .map((file, index) => {
      const docNumber = index + 1;
      return `### Document ${docNumber}: ${file.filename}
${file.content}
`;
    })
    .join('\n');
}

/**
 * Build standard document prompt without context files
 * @param userPrompt - The user's text prompt
 * @returns Standard document generation prompt
 */
function buildStandardDocumentPrompt(userPrompt: string): string {
  return `You are an expert educational content creator. Generate a comprehensive educational document based on the following prompt.

**Prompt:** ${userPrompt}

**Requirements:**
- Create a comprehensive educational document with minimum 1000 words
- Start with a clear H1 title (# Title)
- Include these sections:
  * ## Glossary (define key terms in a table)
  * ## Core Concepts (detailed explanations with subsections)
  * ## Examples (practical examples and use cases)
  * ## Summary (key takeaways)
- Use markdown tables to present structured information
- Include ASCII diagrams in code blocks for visual explanations
- Add relevant examples and detailed explanations
- Maintain professional, educational tone
- Use proper markdown formatting throughout

Generate the complete educational document now:`;
}

/**
 * Validate files before prompt generation
 * @param files - Files to validate
 * @throws Error if validation fails
 */
export function validateContextFiles(files: IFileContent[]): void {
  if (files.length === 0) {
    return; // No files is valid
  }

  if (files.length > 5) {
    throw new Error('Cannot attach more than 5 files');
  }

  // Check for empty files
  const emptyFiles = files.filter(f => !f.content || f.content.trim().length === 0);
  if (emptyFiles.length > 0) {
    throw new Error(`Empty file content: ${emptyFiles[0].filename}`);
  }

  // Check file sizes
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE);
  if (oversizedFiles.length > 0) {
    throw new Error(`File too large: ${oversizedFiles[0].filename} (max 5MB)`);
  }

  // Estimate total token count (rough approximation: 1 token ≈ 4 characters)
  const totalCharacters = files.reduce((sum, f) => sum + f.content.length, 0);
  const estimatedTokens = Math.ceil(totalCharacters / 4);
  const MAX_CONTEXT_TOKENS = 200000; // Leave room for prompt and response

  if (estimatedTokens > MAX_CONTEXT_TOKENS) {
    throw new Error(
      `Total context size too large: ${estimatedTokens} tokens (max ${MAX_CONTEXT_TOKENS})`
    );
  }
}

/**
 * Calculate estimated token count for context
 * @param files - Files to count tokens for
 * @returns Estimated token count
 */
export function estimateContextTokens(files: IFileContent[]): number {
  if (!files || files.length === 0) return 0;
  
  const totalCharacters = files.reduce((sum, f) => sum + f.content.length, 0);
  return Math.ceil(totalCharacters / 4); // Rough estimate
}

