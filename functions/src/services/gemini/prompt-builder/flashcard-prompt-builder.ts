import { buildFlashcardDescriptionRulesSection } from './flashcard-desc-prompt-builder';
import { PLANNED_FLASHCARD_COUNT } from '../../flashcards/flashcard-types';

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

export interface FlashcardPlanPromptParams {
  content: string;
  rules?: string;
  options?: FlashcardPromptOptions;
  termCount?: number;
  excludedTerms?: string[];
}

export interface FlashcardBatchExpandPromptParams {
  content: string;
  rules?: string;
  descriptionRules?: string;
  options?: FlashcardPromptOptions;
  slots: Array<{ index: number; term: string; hint?: string }>;
  strict?: boolean;
}

export const FlashcardPromptBuilder = {
  buildLanguageClassificationPrompt(content: string): string {
    return `You classify whether study material is primarily for learning a foreign language vocabulary.

Be conservative: only mark isLanguageLearning=true when the document clearly teaches words/phrases in a target language (word lists, bilingual vocab, language textbook excerpts, phrase drills). General topic study in English (or any single language of instruction that is not vocabulary study) is NOT language learning.

Return a single JSON object only (double-quoted keys/strings, lowercase true/false, no markdown):
{"isLanguageLearning":true,"confidence":0.0,"targetLanguageCode":null,"targetLanguageName":null}

Rules:
- confidence is a number from 0 to 1
- When isLanguageLearning is false, set targetLanguageCode and targetLanguageName to null
- When isLanguageLearning is true, targetLanguageCode must be a BCP-47 code (e.g. "es", "ja", "zh-Hans", "yue") and targetLanguageName a display name (e.g. "Spanish", "Cantonese")
- Do not wrap in markdown or add commentary

Document excerpt:
---
${content.slice(0, 12000)}
---`;
  },

  buildLearnedTermsExclusionSection(learnedTerms: string[]): string {
    if (learnedTerms.length === 0) {
      return '';
    }

    return `[LEARNED VOCABULARY — DO NOT USE]
The learner has already mastered these terms. You MUST NOT include any of them in your output:
${learnedTerms
  .slice(0, 200)
  .map((term) => `- ${term}`)
  .join('\n')}`;
  },

  buildFlashcardPlanPrompt(params: FlashcardPlanPromptParams): string {
    const {
      content,
      rules,
      options,
      termCount = PLANNED_FLASHCARD_COUNT,
      excludedTerms = [],
    } = params;
    const isLanguageLearning = Boolean(options?.isLanguageLearning);
    const targetLanguageName = options?.targetLanguageName?.trim();
    const learnedTerms = options?.learnedTerms?.filter((term) => term.trim().length > 0) ?? [];

    const persona = isLanguageLearning
      ? `You are an expert language tutor selecting vocabulary from study material${targetLanguageName ? ` for ${targetLanguageName}` : ''}.`
      : 'You are an expert educator selecting key terms and concepts from study material.';

    const termRules = isLanguageLearning
      ? `- Each "term" must be a bare target-language word or short phrase only (no emoji, no romanization, no English).
- Prefer vocabulary central to understanding the document.
- Choose diverse, non-overlapping terms.`
      : `- Each "term" is a concise concept label that will seed the flashcard front.
- Prefer terms essential for understanding the material.`;

    const rulesSection = rules?.trim()
      ? `[DOMAIN RULES — presentation context only; do not change JSON shape]
---
${rules.trim()}
---`
      : '';

    const excludedSection =
      excludedTerms.length > 0
        ? `[ALREADY SELECTED — DO NOT REPEAT]
${excludedTerms
  .slice(0, 80)
  .map((term) => `- ${term}`)
  .join('\n')}`
        : '';

    const learnedSection = FlashcardPromptBuilder.buildLearnedTermsExclusionSection(learnedTerms);

    const outputContract = `[SEALED OUTPUT CONTRACT]
- Return a single JSON object only: {"terms":[{"term":"...","hint":"..."}, ...]}
- "terms" must contain exactly ${termCount} objects.
- "hint" is optional — a very short gloss for the planner (one phrase max).
- Do NOT wrap in markdown. No commentary before or after the JSON object.`;

    return [
      persona,
      rulesSection,
      learnedSection,
      excludedSection,
      `[TASK]
Analyze the document and select exactly ${termCount} ${isLanguageLearning ? 'vocabulary terms' : 'key concepts'} for flashcards.
${termRules}`,
      `[DOCUMENT]
---
${content}
---`,
      outputContract,
    ]
      .filter(Boolean)
      .join('\n\n');
  },

  buildFlashcardBatchExpandPrompt(params: FlashcardBatchExpandPromptParams): string {
    const { content, rules, descriptionRules, options, slots, strict = false } = params;
    const isLanguageLearning = Boolean(options?.isLanguageLearning);
    const targetLanguageName = options?.targetLanguageName?.trim();
    const learnedTerms = options?.learnedTerms?.filter((term) => term.trim().length > 0) ?? [];

    const rulesSection = rules?.trim()
      ? `[DOMAIN RULES — customise front/back presentation only]
---
${rules.trim()}
---`
      : '';

    const descriptionSection = buildFlashcardDescriptionRulesSection(descriptionRules);
    const learnedSection = FlashcardPromptBuilder.buildLearnedTermsExclusionSection(learnedTerms);

    const slotList = slots
      .map((slot) => {
        const hint = slot.hint?.trim() ? ` (hint: ${slot.hint.trim()})` : '';
        return `- index ${slot.index}: "${slot.term}"${hint}`;
      })
      .join('\n');

    const fieldList = isLanguageLearning
      ? '"index", "term", "front", "back", "description", "frontHtml", "backHtml", "descriptionHtml"'
      : '"index", "front", "back", "description", "frontHtml", "backHtml", "descriptionHtml"';

    const frontBackRules = isLanguageLearning
      ? `- "term" MUST match the planned term exactly (bare target-language word/phrase only).
- "front" is presentation only (emoji/romanization allowed).
- "back" is meaning/translation for the learner.
- Keep descriptions compact.`
      : `- "front" should present the concept or question.
- "back" should contain a clear definition or answer.
- Keep descriptions compact.`;

    const strictNote = strict
      ? '- STRICT MODE: return valid JSON only. Every listed index must appear exactly once.'
      : '';

    const outputContract = `[SEALED OUTPUT CONTRACT${strict ? ' — STRICT' : ''}]
- Return a single JSON object: {"cards":[...]}
- Emit exactly ${slots.length} card object(s), one per slot below — no more, no fewer.
- Each card must include ${fieldList}.
- "index" must match the slot index from the list below.
${isLanguageLearning ? '- "term" must exactly match the planned term for that slot.' : ''}
${frontBackRules}
${HTML_SAFETY_RULES}
${strictNote}
${targetLanguageName ? `- Target language: ${targetLanguageName}.` : ''}
- Do NOT wrap in markdown. No commentary before or after the JSON object.

[SLOTS TO EXPAND]
${slotList}`;

    return [
      isLanguageLearning
        ? `You expand planned vocabulary terms into complete flashcards${targetLanguageName ? ` for ${targetLanguageName}` : ''}.`
        : 'You expand planned concept labels into complete flashcards.',
      rulesSection,
      descriptionSection,
      learnedSection,
      `[DOCUMENT]
---
${content}
---`,
      outputContract,
    ]
      .filter(Boolean)
      .join('\n\n');
  },
};
