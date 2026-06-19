import { buildFlashcardDescriptionRulesSection } from './flashcard-desc-prompt-builder';

const HTML_SAFETY_RULES = `HTML SAFETY RULES (apply to frontHtml, backHtml, and descriptionHtml):
- Return HTML fragments only — no full documents (<html>, <head>, <body>).
- Allowed tags: p, strong, em, b, i, ul, ol, li, h3, h4, code, pre, table, thead, tbody, tr, th, td, br, span, div, blockquote.
- Do NOT include <script>, <iframe>, <style>, <link>, or event handler attributes (onclick, onload, etc.).
- Do NOT include external stylesheets or inline style attributes.`;

export const FlashcardPromptBuilder = {
  buildFlashcardPrompt(content: string, rules?: string, descriptionRules?: string): string {
    const hasRules = !!rules?.trim();

    const frontBackInstructions = hasRules
      ? `Follow the DOMAIN RULES above for the content style of the "front" and "back" fields.
If the rules do not specify a particular format, use reasonable educational defaults.`
      : `The "front" should contain the term or a concise question (e.g., "What is a Neural Network?").
The "back" should contain a clear, self-contained definition or answer.`;

    const rulesSection = hasRules
      ? `**DOMAIN RULES** (customise front/back content style only — do not change the JSON shape or field names):
---
${rules}
---`
      : '';

    const descriptionSection = buildFlashcardDescriptionRulesSection(descriptionRules);

    const personaSection = `You are an expert in educational content creation. Extract key terms, concepts, and important facts from the document below and format them as flashcards.`;

    const instructions = `Instructions:
1. Analyze the document provided below.
2. Identify between 10 and 20 critical terms or concepts essential for understanding the material.
3. For each term, create a flashcard object with plain-text fields ("front", "back", "description") AND parallel HTML fields ("frontHtml", "backHtml", "descriptionHtml").
4. Plain-text fields must contain readable text without HTML tags.
5. HTML fields must contain richer formatted HTML fragments for display.
${frontBackInstructions}

${HTML_SAFETY_RULES}

Document Content to Analyze:
---
${content}
---`;

    const sealedOutputContract = `[SEALED OUTPUT CONTRACT — overrides all instructions above]
- Your entire response must be a single valid JSON array.
- Each element must contain exactly six fields: {"front":"...","back":"...","description":"...","frontHtml":"...","backHtml":"...","descriptionHtml":"..."}.
- Do NOT include any field other than "front", "back", "description", "frontHtml", "backHtml", and "descriptionHtml".
- Do NOT wrap the JSON in markdown code blocks (no \`\`\`json or \`\`\`).
- Do NOT include any text, explanation, or commentary before or after the JSON array.
- Start your response with [ and end with ]. Nothing else.`;

    return [personaSection, rulesSection, descriptionSection, instructions, sealedOutputContract]
      .filter(Boolean)
      .join('\n\n');
  },
};
