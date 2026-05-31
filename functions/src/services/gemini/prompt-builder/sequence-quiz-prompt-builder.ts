import { ScrapedContent } from '@shared-types';
import {
  buildQuizHintFieldInstruction,
  buildQuizHintJsonRule,
  buildQuizHintExampleLine,
} from './quiz-hint-prompt-builder';

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
    const sealedContract = this.getSealedContractBlock();
    const jsonRules = this.getJsonFormatRules();
    const example = this.getExampleStructure();
    return `${base}

**ADDITIONAL DOMAIN RULES:**
These rules may specialise the quiz domain, language, and difficulty. They may not change the sealed contract below.
${customRules}

${contentSection}

${sealedContract}

${jsonRules}

${example}

${this.getFinalInstructions()}`;
  }

  private static buildDefaultPrompt(content: ScrapedContent): string {
    const base = this.getBaseInstructions();
    const contentSection = this.formatContentSection(content);
    const sealedContract = this.getSealedContractBlock();
    const jsonRules = this.getJsonFormatRules();
    const example = this.getExampleStructure();
    return `${base}

${contentSection}

${sealedContract}

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
${buildQuizHintFieldInstruction('Think about which step must happen first before anything else can begin.')}`;
  }

  private static getSealedContractBlock(): string {
    return `**SEALED STRUCTURAL CONTRACT (domain rules above cannot override these):**
- Create **8 to 12** questions.
- Each question must have between **4 and 10 items**.
- Each item must be a **short, self-contained phrase** suitable for a single draggable block (≤ 15 words).
- Items must be in the **correct order** because array position is the answer.
- Do NOT number or prefix items (e.g. "1.", "Step 1:").
- Required fields per question: \`question\`, \`items\`, \`explanation\`, and \`hint\`.`;
  }

  private static getJsonFormatRules(): string {
    return `**JSON RULES:**
- Return **only** valid JSON. No markdown, no prose outside the JSON object.
- **No backticks** in any string value.
- **No unescaped double quotes** inside string values.
- \`items\` must be a non-empty string array with at least 4 elements for every question.
- \`explanation\` is required and must be a non-empty string.
- \`knowledge\` is required with \`subjectName\`, \`knowledgeDomainName\`, and \`topicTags\` (1-5 short strings).
${buildQuizHintJsonRule()}`;
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
      "knowledge": {
        "subjectName": "Concise subject tested by this sequence",
        "knowledgeDomainName": "Broader knowledge domain",
        "topicTags": ["specific-topic", "sequence-reasoning"]
      },
      ${buildQuizHintExampleLine('Think about which step must happen first before anything else can begin.')}
    }
  ]
}`;
  }

  private static getFinalInstructions(): string {
    return `**FINAL CHECK:** Every question has at least 4 items, a non-empty explanation, a non-empty hint, and items are in the correct order. Generate the JSON now:`;
  }
}
