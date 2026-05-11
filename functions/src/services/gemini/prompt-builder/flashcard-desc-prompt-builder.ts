const DEFAULT_DESCRIPTION_INSTRUCTION = `For each flashcard, generate a concise "description" field (1–2 sentences in markdown) that gives a practical usage example or mnemonic for the concept — enough for a learner to see it applied in context.`;

/**
 * Build the description-rules section that is injected into the flashcard prompt.
 * When custom rules are supplied they fully replace the built-in default.
 */
export function buildFlashcardDescriptionRulesSection(descriptionRules?: string): string {
  const text = descriptionRules?.trim();
  if (text) {
    return `**DESCRIPTION GENERATION RULES** (govern the "description" field only — do not change the JSON shape or other fields):
---
${text}
---`;
  }
  return `**DESCRIPTION INSTRUCTIONS** (default):
${DEFAULT_DESCRIPTION_INSTRUCTION}`;
}
