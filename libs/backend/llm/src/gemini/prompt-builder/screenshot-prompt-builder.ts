export interface ScreenshotPromptInput {
  userPrompt?: string;
  rules?: string;
}

export class ScreenshotPromptBuilder {
  static buildDocumentPrompt({ userPrompt, rules }: ScreenshotPromptInput): string {
    const hasRules = !!rules?.trim();
    const hasUserPrompt = !!userPrompt?.trim();

    const personaSection =
      'You are an expert vision AI. Analyze the provided screenshot and produce StudyForge HTML fragment output.';

    const defaultBehaviorSection = hasRules
      ? `**DEFAULT BEHAVIOR** (used only when Domain Rules and User Instructions do not specify otherwise):
- Extract visible content from the screenshot.
- Apply Domain Rules to that content. If Domain Rules define an output format, produce that format.
- Preserve code blocks and other content Domain Rules say to leave unchanged.
- Do NOT invent a comprehensive learning guide, glossary, or tutorial unless Domain Rules ask for it.
- Do NOT wrap the entire response in a code block.`
      : `**DEFAULT BEHAVIOR**:
- Extract ALL visible text, preserving headings, paragraphs, lists, tables, and code blocks as HTML.
- Include relevant metadata (page title, author, date if visible).
- Preserve the hierarchical structure of the content.
- If the screenshot shows a UI, describe the interface, its purpose, and its components.
- Do NOT wrap the entire response in a code block.
- Start with a descriptive H1 heading summarizing the screenshot content.`;

    const rulesSection = hasRules
      ? `**DOMAIN RULES** (primary task — mandatory; override Default Behavior):
---
${rules.trim()}
---
Follow these rules exactly. If they define an output format, produce that result — not a plain OCR extract.`
      : '';

    const userSection = hasUserPrompt
      ? `**USER INSTRUCTIONS** (override Domain Rules and Default Behavior when they conflict):
${userPrompt.trim()}`
      : '';

    const sealedOutputContract = `[SEALED OUTPUT CONTRACT — overrides all instructions above when they conflict]
- Output ONLY an HTML fragment. No preamble, no chain-of-thought, and no commentary outside the required format.
- Do NOT wrap the entire response in a code block.
- Apply instructions in this priority order: User Instructions → Domain Rules → Default Behavior.
- When Domain Rules or User Instructions define an output format, suppress all default structural requirements such as H1 headings, glossaries, tutorials, or summary sections.
- Do NOT include Mermaid diagrams, Plotly graphs, or mathematical LaTeX unless Domain Rules explicitly ask for them.`;

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
