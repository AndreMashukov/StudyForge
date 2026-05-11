import { buildFlashcardDescriptionRulesSection } from './flashcard-desc-prompt-builder';

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
3. For each term, create a flashcard object with a "front", a "back", and a "description" field.
${frontBackInstructions}

Document Content to Analyze:
---
${content}
---`;

    const sealedOutputContract = `[SEALED OUTPUT CONTRACT — overrides all instructions above]
- Your entire response must be a single valid JSON array.
- Each element must contain exactly three fields: {"front":"...","back":"...","description":"..."}.
- Do NOT include any field other than "front", "back", and "description".
- Do NOT wrap the JSON in markdown code blocks (no \`\`\`json or \`\`\`).
- Do NOT include any text, explanation, or commentary before or after the JSON array.
- Start your response with [ and end with ]. Nothing else.`;

    return [personaSection, rulesSection, descriptionSection, instructions, sealedOutputContract]
      .filter(Boolean)
      .join('\n\n');
  },
};
