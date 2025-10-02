/**
 * Document Prompt Builder for Gemini AI
 * 
 * This module builds prompts for generating comprehensive technical documents
 * from user text prompts with structured content including tables and ASCII diagrams.
 */

export class DocumentPromptBuilder {
  
  /**
   * Build the comprehensive prompt for document generation from user text prompt
   * @param userPrompt - The user's text prompt describing what document to generate
   * @returns Formatted prompt string for Gemini AI
   */
  static buildDocumentPrompt(userPrompt: string): string {
    const baseInstructions = this.getBaseInstructions();
    const userPromptSection = this.formatUserPromptSection(userPrompt);
    const requirementsSection = this.getRequirementsSection();
    const structureSection = this.getStructureSection();
    const formattingGuidelines = this.getFormattingGuidelines();
    const asciiDiagramGuidelines = this.getAsciiDiagramGuidelines();
    const finalInstructions = this.getFinalInstructions();

    return `${baseInstructions}

${userPromptSection}

${requirementsSection}

${structureSection}

${formattingGuidelines}

${asciiDiagramGuidelines}

${finalInstructions}`;
  }

  /**
   * Base instructions for document generation
   */
  private static getBaseInstructions(): string {
    return `You are a technical documentation expert with deep knowledge across various technical domains. Your task is to generate comprehensive, well-structured documentation based on user prompts.`;
  }

  /**
   * Format the user's prompt section
   */
  private static formatUserPromptSection(userPrompt: string): string {
    return `**USER REQUEST:**
"${userPrompt}"

Generate a comprehensive technical document that fully addresses this topic.`;
  }

  /**
   * Content requirements section
   */
  private static getRequirementsSection(): string {
    return `**CONTENT REQUIREMENTS:**

1. **Minimum Length**: 1000 words (excluding diagrams and tables)
2. **Tables**: Include 1-2 well-formatted markdown tables that are contextually relevant
   - Use tables to compare features, list specifications, show relationships, etc.
   - Ensure tables are properly formatted with headers and alignment
   - Tables should add value and clarity to the content
3. **ASCII Diagrams**: Include 2-3 ASCII diagrams in code blocks
   - Choose diagram types based on content (flowcharts, architecture, relationships, processes, etc.)
   - Diagrams should illustrate key concepts visually
   - Use box drawing characters and symbols for clarity
4. **Code Examples**: Include code examples if relevant to the topic
   - Use appropriate language syntax highlighting
   - Add comments to explain complex parts
   - Ensure code is practical and runnable
5. **Depth**: Provide detailed explanations with technical accuracy
6. **Clarity**: Write in clear, professional technical writing style`;
  }

  /**
   * Required document structure
   */
  private static getStructureSection(): string {
    return `**REQUIRED DOCUMENT STRUCTURE:**

Your document MUST follow this structure:

# [Document Title]
*Generate an appropriate, descriptive title based on the user's prompt*

## Glossary
- Define key terms and concepts that will be used throughout the document
- Include 5-10 essential terms with clear, concise definitions
- Format as a list or table for easy reference

## Core Concepts
- Provide comprehensive explanations of the fundamental concepts
- Break down complex ideas into digestible sections
- Use subsections (###) to organize different aspects
- Include real-world context and applications
- This should be the most substantial section (400-600 words)

## Examples
- Provide practical, concrete examples that demonstrate the concepts
- Include code snippets if applicable (with proper syntax highlighting)
- Use realistic scenarios that readers can relate to
- Show both simple and complex use cases
- Explain each example thoroughly (200-400 words)

## Summary
- Recap the key takeaways from the document
- Highlight the most important points
- Provide actionable insights or next steps
- Keep it concise but comprehensive (100-200 words)`;
  }

  /**
   * Markdown formatting guidelines
   */
  private static getFormattingGuidelines(): string {
    return `**MARKDOWN FORMATTING GUIDELINES:**

1. **Headers**:
   - Use # for main title
   - Use ## for major sections (Glossary, Core Concepts, Examples, Summary)
   - Use ### for subsections within major sections
   - Use #### for sub-subsections if needed

2. **Emphasis**:
   - Use **bold** for important terms and concepts
   - Use *italics* for emphasis and technical terms
   - Use \`inline code\` for code references, commands, and technical identifiers

3. **Lists**:
   - Use bullet points (-) for unordered lists
   - Use numbers (1., 2., 3.) for sequential steps or ordered information
   - Indent nested lists properly

4. **Code Blocks**:
   - Use triple backticks with language identifier: \`\`\`javascript, \`\`\`python, etc.
   - Include comments in code to explain functionality
   - Keep code examples concise but complete

5. **Tables**:
   - Use proper markdown table syntax with pipes (|) and hyphens (-)
   - Align columns using colons (:---, :---:, ---:)
   - Include clear headers
   - Example:
   \`\`\`
   | Feature | Description | Use Case |
   |---------|-------------|----------|
   | Item 1  | Details...  | When...  |
   | Item 2  | Details...  | When...  |
   \`\`\`

6. **Links and References**:
   - Use inline links: [text](url)
   - Reference related concepts within the document`;
  }

  /**
   * ASCII diagram guidelines
   */
  private static getAsciiDiagramGuidelines(): string {
    return `**ASCII DIAGRAM GUIDELINES:**

Include 2-3 ASCII diagrams wrapped in code blocks (without language identifier).

**Box Drawing Characters to Use**:
- Corners: ┌ ┐ └ ┘ ╔ ╗ ╚ ╝
- Lines: │ ─ ║ ═
- Intersections: ├ ┤ ┬ ┴ ┼
- Arrows: → ← ↑ ↓ ⇒ ⇐ ⇑ ⇓
- Symbols: ✅ ❌ ⚠️ 🔄 ⭐ ◆ ● ○

**Diagram Types** (choose based on content):
1. **Flowcharts**: Show process flows and decision trees
2. **Architecture Diagrams**: Illustrate system components and relationships
3. **Hierarchy Diagrams**: Show organizational or structural hierarchies
4. **Sequence Diagrams**: Display interactions over time
5. **Comparison Diagrams**: Compare different approaches or options
6. **Data Flow Diagrams**: Show how data moves through a system

**Diagram Example 1** (Flowchart):
\`\`\`
┌─────────────────┐
│  Start Process  │
└────────┬────────┘
         ↓
    ┌────────────┐
    │  Check X?  │
    └─────┬──────┘
          │
    ┌─────┴─────┐
    │           │
   Yes         No
    │           │
    ↓           ↓
┌──────┐   ┌──────┐
│ Do A │   │ Do B │
└───┬──┘   └───┬──┘
    │           │
    └─────┬─────┘
          ↓
    ┌──────────┐
    │   End    │
    └──────────┘
\`\`\`

**Diagram Example 2** (Architecture):
\`\`\`
╔════════════════════════════════════╗
║        Client Application          ║
╚═══════════════╦════════════════════╝
                ↓
        ┌───────────────┐
        │   API Layer   │
        └───────┬───────┘
                ↓
    ┌───────────┴───────────┐
    │                       │
┌───▼─────┐         ┌───────▼───┐
│Database │         │   Cache   │
└─────────┘         └───────────┘
\`\`\`

**Diagram Best Practices**:
- Keep diagrams clear and not overly complex
- Add labels and descriptions
- Use consistent spacing and alignment
- Ensure diagrams fit within reasonable width (60-80 characters)
- Always wrap diagrams in code blocks (triple backticks)
- Add a brief caption or explanation before or after each diagram`;
  }

  /**
   * Final instructions
   */
  private static getFinalInstructions(): string {
    return `**CRITICAL OUTPUT REQUIREMENTS:**

1. **Pure Markdown**: Output ONLY markdown content
   - NO wrapper code blocks (don't wrap the entire document in \`\`\`markdown)
   - NO additional commentary or meta-text
   - Start directly with the document title

2. **Content Validation**:
   - Ensure the document has at least 1000 words (excluding tables and diagrams)
   - Verify all 4 required sections are present and properly formatted
   - Confirm 1-2 tables are included and properly formatted
   - Confirm 2-3 ASCII diagrams are included in code blocks
   - Check that all markdown syntax is correct

3. **Quality Standards**:
   - Write in professional technical documentation style
   - Use accurate technical information
   - Provide practical, actionable insights
   - Ensure content directly addresses the user's prompt
   - Make the document comprehensive but accessible

4. **Structure Compliance**:
   - Follow the exact section structure: Glossary → Core Concepts → Examples → Summary
   - Use proper heading levels
   - Maintain consistent formatting throughout

**Generate the comprehensive technical document now:**`;
  }
}


