import { ScrapedContent } from '@shared-types';

/**
 * Prompt builder for sequence quizzes: the learner arranges items in the correct order.
 *
 * The base instructions are intentionally domain-agnostic — they define only the structural
 * contract (items array, JSON shape, question count). Domain-specific behaviour (e.g. language
 * learning, algorithm steps, process flows) is injected via rules attached to a directory
 * with RuleApplicability.SEQUENCE_QUIZ. When no rules are present, Gemini infers meaningful
 * sequences directly from the source content.
 */
export class SequenceQuizPromptBuilder {
  static buildSequenceQuizPrompt(
    content: ScrapedContent,
    additionalPrompt?: string
  ): string {
    if (additionalPrompt?.trim()) {
      return this.buildFromCustomRules(content, additionalPrompt);
    }
    return this.buildDefaultPrompt(content);
  }

  private static buildFromCustomRules(
    content: ScrapedContent,
    customRules: string
  ): string {
    const base = this.getBaseInstructions();
    const contentSection = this.formatContentSection(content);
    const jsonRules = this.getJsonFormatRules();
    const example = this.getExampleStructure();
    return `${base}

**ADDITIONAL DOMAIN RULES (supplement the requirements above; do not change the JSON shape, question count 8–12, or per-question item count 4–10):**
${customRules}

${contentSection}

${jsonRules}

${example}

${this.getFinalInstructions()}`;
  }

  private static buildDefaultPrompt(content: ScrapedContent): string {
    const base = this.getBaseInstructions();
    const contentSection = this.formatContentSection(content);
    const jsonRules = this.getJsonFormatRules();
    const example = this.getExampleStructure();
    return `${base}

${contentSection}

${jsonRules}

${example}

${this.getFinalInstructions()}`;
  }

  /**
   * Domain-agnostic structural skeleton.
   * Deliberately avoids mentioning algorithms, sentences, languages, or any specific domain
   * so that rules can freely specialise the output for any use case.
   */
  private static getBaseInstructions(): string {
    return `You are an expert educator. Generate a **sequence ordering quiz** from the source material below.

Each question presents a set of items that the learner must arrange in the correct order by dragging blocks on a canvas.

Analyse the source content and identify **meaningful sequences**: ordered steps, processes, cause-and-effect chains, hierarchies, or any content where the position of each item relative to others is significant.

**ITEM RULES:**
- Each question must have between **4 and 10 items**.
- Each item must be a **short, self-contained phrase** suitable for a single draggable block (≤ 15 words).
- Items must be **unambiguous** — there should be exactly one defensible correct ordering.
- **Do NOT number or prefix items** (e.g. "1.", "Step 1:") — the correct order is conveyed only by array position.
- Vary the number of items across questions so not every question has the same length.`;
  }

  private static formatContentSection(content: ScrapedContent): string {
    return `**SOURCE TITLE:** ${content.title}
${content.author ? `**AUTHOR:** ${content.author}` : ''}

**SOURCE CONTENT:**
${content.content}

**TASK:**
Create **8 to 12** questions. For each question provide:
- \`question\`: a clear instruction telling the learner what to arrange (e.g. "Arrange the steps of X in order")
- \`items\`: an array of strings in the **CORRECT** order (4–10 items)
- \`explanation\`: a concise explanation of why this order is correct
- \`hint\`: a short, helpful clue that nudges the learner without giving away the full answer (e.g. "Think about which step must happen before any other")`;
  }

  private static getJsonFormatRules(): string {
    return `**JSON RULES:**
- Return **only** valid JSON. No markdown, no prose outside the JSON object.
- **No backticks** in any string value.
- **No unescaped double quotes** inside string values.
- \`items\` must be a non-empty string array with at least 4 elements for every question.
- \`explanation\` is required and must be a non-empty string.
- \`hint\` is required and must be a short, non-empty string (one sentence, max 20 words).`;
  }

  private static getExampleStructure(): string {
    return `**REQUIRED JSON SHAPE:**
{
  "title": "Short descriptive title for the quiz",
  "questions": [
    {
      "question": "Arrange these items in the correct order:",
      "items": ["First item", "Second item", "Third item", "Fourth item"],
      "explanation": "Why this order is correct and how each step follows from the previous.",
      "hint": "Think about which step must happen first before anything else can begin."
    }
  ]
}`;
  }

  private static getFinalInstructions(): string {
    return `**FINAL CHECK:** Every question has at least 4 items, a non-empty explanation, and items are in the correct order. Generate the JSON now:`;
  }
}
