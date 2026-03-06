export const FlashcardPromptBuilder = {
  buildFlashcardPrompt(content: string, rules?: string): string {
    const hasRules = !!rules?.trim();

    const frontBackInstructions = hasRules
      ? `4. The content of the "front" and "back" fields is determined by the injected rules below — follow them exactly.
5. If the rules do not specify a particular format, use reasonable educational defaults.`
      : `4. The "front" should contain the term or a concise question (e.g., "What is a Neural Network?").
5. The "back" should contain a clear, self-contained definition or answer.`;

    const rulesSection = hasRules
      ? `\nINJECTED RULES (take priority over default instructions):\n---\n${rules}\n---\n`
      : '';

    return `You are an expert in educational content creation. Your task is to extract key terms, concepts, and important facts from the following document and format them as flashcards.

CRITICAL OUTPUT RULES:
- Your entire response must be a single valid JSON array.
- Do NOT wrap the JSON in markdown code blocks (no \`\`\`json or \`\`\`).
- Do NOT include any text, explanation, or commentary before or after the JSON array.
- Start your response with [ and end with ]. Nothing else.
${rulesSection}
Instructions:
1. Analyze the document provided below.
2. Identify between 10 and 20 critical terms or concepts essential for understanding the material.
3. For each term, create a flashcard object with a "front" and a "back" field.
${frontBackInstructions}

Required output format (raw JSON array, no markdown):
[{"front":"Term or Question 1","back":"Clear and concise definition or answer 1."},{"front":"Term or Question 2","back":"Clear and concise definition or answer 2."}]

Document Content to Analyze:
---
${content}
---`;
  },
};
