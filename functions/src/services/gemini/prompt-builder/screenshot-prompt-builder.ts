export interface ScreenshotPromptInput {
  userPrompt?: string;
  rules?: string;
}

export class ScreenshotPromptBuilder {
  static buildDocumentPrompt({ userPrompt, rules }: ScreenshotPromptInput): string {
    const sections = [
      `You are an educational content extraction AI. Analyze the provided screenshot and produce a comprehensive, well-structured Markdown document.

Instructions:
- Extract ALL visible text, preserving headings, paragraphs, lists, tables, and code blocks.
- Describe any diagrams, charts, or visual elements in detail using Markdown (use fenced blocks with 'mermaid' for diagrams when possible).
- Include relevant metadata (page title, author, date if visible).
- Preserve the hierarchical structure of the content.
- If the screenshot shows a UI, describe the interface, its purpose, and its components.
- Do NOT wrap the response in a Markdown code block.
- Start with a descriptive H1 heading summarizing the screenshot content.`,
    ];

    if (rules?.trim()) {
      sections.push(`Additional Rules for Content Generation:\n${rules.trim()}`);
    }

    if (userPrompt?.trim()) {
      sections.push(`Additional User Instructions:\n${userPrompt.trim()}`);
    }

    return sections.join('\n\n');
  }
}