export interface ScreenshotPromptInput {
  userPrompt?: string;
  rules?: string;
}

export class ScreenshotPromptBuilder {
  static buildDocumentPrompt({ userPrompt, rules }: ScreenshotPromptInput): string {
    const hasRules = !!rules?.trim();
    const hasUserPrompt = !!userPrompt?.trim();

    const personaSection =
      'You are an expert vision AI. Analyze the provided screenshot and produce Markdown output.';

    const defaultBehaviorSection = hasRules
      ? `**DEFAULT BEHAVIOR** (used only when Domain Rules and User Instructions do not specify otherwise):
- Extract visible text, preserving headings, lists, tables, and code blocks.
- Briefly describe diagrams, charts, or UI elements when relevant.
- Do NOT wrap the entire response in a Markdown code block.`
      : `**DEFAULT BEHAVIOR**:
- Extract ALL visible text, preserving headings, paragraphs, lists, tables, and code blocks.
- Describe any diagrams, charts, or visual elements in detail using Markdown (use fenced blocks with 'mermaid' for diagrams when possible).
- Include relevant metadata (page title, author, date if visible).
- Preserve the hierarchical structure of the content.
- If the screenshot shows a UI, describe the interface, its purpose, and its components.
- Do NOT wrap the entire response in a Markdown code block.
- Start with a descriptive H1 heading summarizing the screenshot content.`;

    const rulesSection = hasRules
      ? `**DOMAIN RULES** (override Default Behavior for format, structure, tone, and scope when they conflict):
---
${rules.trim()}
---`
      : '';

    const userSection = hasUserPrompt
      ? `**USER INSTRUCTIONS** (override Domain Rules and Default Behavior when they conflict):
${userPrompt.trim()}`
      : '';

    const sealedOutputContract = `[SEALED OUTPUT CONTRACT — overrides all instructions above when they conflict]
- Output ONLY markdown content. No preamble, no chain-of-thought, and no commentary outside the required format.
- Do NOT wrap the entire response in a \`\`\`markdown code block.
- Apply instructions in this priority order: User Instructions → Domain Rules → Default Behavior.
- When Domain Rules or User Instructions define an output format (for example, a table only), suppress all default structural requirements such as H1 headings, glossaries, or summary sections.`;

    return [
      personaSection,
      defaultBehaviorSection,
      rulesSection,
      userSection,
      sealedOutputContract,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
}
