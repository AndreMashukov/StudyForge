import { buildFlashcardDescriptionRulesSection } from './flashcard-desc-prompt-builder';

const HTML_SAFETY_RULES = `HTML SAFETY RULES (apply to frontHtml, backHtml, and descriptionHtml):
- Return HTML fragments only — no full documents (<html>, <head>, <body>).
- Allowed tags: p, strong, em, b, i, ul, ol, li, h3, h4, code, pre, table, thead, tbody, tr, th, td, br, span, div, blockquote.
- Do NOT include <script>, <iframe>, <style>, <link>, or event handler attributes (onclick, onload, etc.).
- Do NOT include external stylesheets or inline style attributes.`;

export interface FlashcardPromptOptions {
  isLanguageLearning?: boolean;
  targetLanguageName?: string;
  learnedTerms?: string[];
}

export const FlashcardPromptBuilder = {
  buildLanguageClassificationPrompt(content: string): string {
    return `You classify whether study material is primarily for learning a foreign language vocabulary.

Be conservative: only mark isLanguageLearning=true when the document clearly teaches words/phrases in a target language (word lists, bilingual vocab, language textbook excerpts, phrase drills). General topic study in English (or any single language of instruction that is not vocabulary study) is NOT language learning.

Return a single JSON object only:
{"isLanguageLearning":boolean,"confidence":number,"targetLanguageCode":string|null,"targetLanguageName":string|null}

Rules:
- confidence is from 0 to 1
- When isLanguageLearning is false, set targetLanguageCode and targetLanguageName to null
- When isLanguageLearning is true, targetLanguageCode must be a BCP-47 code (e.g. "es", "ja", "zh-Hans") and targetLanguageName a display name (e.g. "Spanish")
- Do not wrap in markdown

Document excerpt:
---
${content.slice(0, 12000)}
---`;
  },

  buildFlashcardPrompt(
    content: string,
    rules?: string,
    descriptionRules?: string,
    options?: FlashcardPromptOptions
  ): string {
    const hasRules = !!rules?.trim();
    const isLanguageLearning = Boolean(options?.isLanguageLearning);
    const targetLanguageName = options?.targetLanguageName?.trim();
    const learnedTerms = options?.learnedTerms?.filter((term) => term.trim().length > 0) ?? [];

    const frontBackInstructions = isLanguageLearning
      ? `This is a LANGUAGE-LEARNING flashcard set${targetLanguageName ? ` for ${targetLanguageName}` : ''}.
- "front" MUST be the target-language word or short phrase being learned (not a quiz-style question).
- "back" MUST be the meaning, translation, and/or brief usage note for a learner.
- Prefer vocabulary central to the document.`
      : hasRules
        ? `Follow the DOMAIN RULES above for the content style of the "front" and "back" fields.
If the rules do not specify a particular format, use reasonable educational defaults.`
        : `The "front" should contain the term or a concise question (e.g., "What is a Neural Network?").
The "back" should contain a clear, self-contained definition or answer.`;

    const learnedTermsSection =
      isLanguageLearning && learnedTerms.length > 0
        ? `**LEARNED VOCABULARY** (soft deprioritize — avoid these terms when good alternatives exist; include only if central to the document):
${learnedTerms
  .slice(0, 200)
  .map((term) => `- ${term}`)
  .join('\n')}`
        : '';

    const rulesSection = hasRules
      ? `**DOMAIN RULES** (customise front/back content style only — do not change the JSON shape or field names):
---
${rules}
---`
      : '';

    const descriptionSection = buildFlashcardDescriptionRulesSection(descriptionRules);

    const personaSection = isLanguageLearning
      ? `You are an expert language tutor. Extract vocabulary from the document below and format them as flashcards.`
      : `You are an expert in educational content creation. Extract key terms, concepts, and important facts from the document below and format them as flashcards.`;

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

    return [
      personaSection,
      rulesSection,
      descriptionSection,
      learnedTermsSection,
      instructions,
      sealedOutputContract,
    ]
      .filter(Boolean)
      .join('\n\n');
  },
};
