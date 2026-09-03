import { ScrapedContent } from '@shared-types';
import {
  buildQuizHintFieldInstruction,
  buildQuizHintJsonRule,
  buildQuizHintExampleLine,
} from './quiz-hint-prompt-builder';

/**
 * Prompt builder for match quizzes: the learner assigns option chips to prompt rows.
 *
 * The base instructions are intentionally domain-agnostic — they define only the structural
 * contract (prompts/options arrays with stable IDs, JSON shape, question count). Domain-specific
 * behaviour (e.g. terminology matching, concept-to-definition pairing) is injected via rules
 * attached to a directory with RuleApplicability.QUIZ. When no rules are present, the model
 * infers meaningful pairs directly from the source content.
 */
export class MatchQuizPromptBuilder {
  static buildMatchQuizPrompt(
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
   * Deliberately avoids mentioning any specific domain so that rules can freely
   * specialise the output for any use case.
   */
  private static getBaseInstructions(): string {
    return `You are an expert educator. Generate a **match quiz** from the source material below.

Each question presents a table of descriptions (prompts) on the left and a bank of draggable option chips. The learner must assign each prompt exactly one option chip from the bank.

Analyse the source content and identify **meaningful pairs**: terms and their definitions, concepts and their descriptions, names and their roles, causes and their effects — any content where a one-to-one pairing is defensible.

**PAIR RULES:**
- Each question must have between **4 and 6 prompts** (table rows).
- Each prompt must be a **description of the thing to match** (a definition, property, or characteristic) of **≤ 25 words**.
- Each option must be a **short label** suitable for a single chip (≤ 8 words), typically the name or term being described.
- Pairings must be **unambiguous** — each option must clearly belong to exactly one prompt.
- Do NOT reveal the pairing by reusing the same wording in a prompt and its option.
- Add **1 or 2 distractor options** per question: plausible but incorrect chips whose \`correctPromptId\` is **null**. Distractors must not duplicate the text of any correct option.
- All option texts within one question must be **unique**.`;
  }

  private static formatContentSection(content: ScrapedContent): string {
    return `**SOURCE TITLE:** ${content.title}
${content.author ? `**AUTHOR:** ${content.author}` : ''}

**SOURCE CONTENT:**
${content.content}

**TASK:**
Create **5** questions. For each question provide:
- \`prompts\`: an array of objects \`{ "id": "p1", "text": "..." }\` in display order (4–6 prompts). Number the ids p1, p2, ... in order.
- \`options\`: an array of objects \`{ "id": "o1", "text": "...", "correctPromptId": "p1" }\` covering every prompt id exactly once, plus 1–2 distractors with \`correctPromptId: null\`.
- \`explanation\`: a concise explanation of the correct pairings.
${buildQuizHintFieldInstruction('Look for the pairing that only fits one description.')}`;
  }

  private static getSealedContractBlock(): string {
    return `**SEALED STRUCTURAL CONTRACT (domain rules above cannot override these):**
- Create **exactly 5** questions.
- Each question must have between **4 and 6 prompts**.
- Option ids must be o1, o2, ... and prompt ids p1, p2, ... within each question.
- Every prompt id must appear as \`correctPromptId\` on exactly one option.
- Distractor options must have \`correctPromptId: null\`.
- Option texts must be short chip labels (≤ 8 words) and unique within a question.
- Do NOT reveal the answer inside the prompt text.
- Required fields per question: \`prompts\`, \`options\`, \`explanation\`, and \`hint\`.`;
  }

  private static getJsonFormatRules(): string {
    return `**JSON RULES:**
- Return **only** valid JSON. No markdown, no prose outside the JSON object.
- **No backticks** in any string value.
- **No unescaped double quotes** inside string values.
- \`prompts\` must be a non-empty array of 4–6 objects, each with a non-empty \`id\` and \`text\`.
- \`options\` must contain one option per prompt id (its \`correctPromptId\`) plus 1–2 distractors with \`correctPromptId: null\`.
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
      "prompts": [
        { "id": "p1", "text": "A decentralized architecture where agents coordinate directly without a central manager." },
        { "id": "p2", "text": "A centralized architecture where a single agent delegates tasks to worker agents." }
      ],
      "options": [
        { "id": "o1", "text": "Peer-to-Peer Pattern", "correctPromptId": "p1" },
        { "id": "o2", "text": "Orchestrator Pattern", "correctPromptId": "p2" },
        { "id": "o3", "text": "State Management", "correctPromptId": null }
      ],
      "explanation": "Why each option pairs with its prompt and why the distractor matches nothing.",
      "knowledge": {
        "subjectName": "Concise subject tested by this matching exercise",
        "knowledgeDomainName": "Broader knowledge domain",
        "topicTags": ["specific-topic", "concept-matching"]
      },
      ${buildQuizHintExampleLine('Look for the description that only fits one term.')}
    }
  ]
}`;
  }

  private static getFinalInstructions(): string {
    return `**FINAL CHECK:** Every question has 4–6 prompt objects, one matching option per prompt plus 1–2 distractors with \`correctPromptId: null\`, unique option texts, a non-empty explanation, and a non-empty hint. Generate the JSON now:`;
  }
}