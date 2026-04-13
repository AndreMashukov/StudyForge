import { ScrapedContent } from '@shared-types';

/**
 * Prompt builder for diagram quizzes: each answer option is a Mermaid diagram.
 */
export class DiagramQuizPromptBuilder {
  static generateRandomCorrectAnswers(questionCount: number): number[] {
    const maxQuestions = Math.min(questionCount, 20);
    const randomAnswers: number[] = [];
    for (let i = 0; i < maxQuestions; i++) {
      randomAnswers.push(Math.floor(Math.random() * 4));
    }
    return randomAnswers;
  }

  static buildDiagramQuizPrompt(
    content: ScrapedContent,
    additionalPrompt?: string,
    randomCorrectAnswers: number[] = []
  ): string {
    if (additionalPrompt?.trim()) {
      return this.buildFromCustomRules(content, additionalPrompt, randomCorrectAnswers);
    }
    return this.buildDefaultPrompt(content, randomCorrectAnswers);
  }

  private static buildFromCustomRules(
    content: ScrapedContent,
    customRules: string,
    randomCorrectAnswers: number[] = []
  ): string {
    const contentSection = this.formatContentSection(content);
    const distribution = this.getRandomAnswerDistributionRules(randomCorrectAnswers);
    const jsonRules = this.getJsonFormatRules();
    const example = this.getExampleStructure();
    return `${customRules}

${contentSection}

${distribution}

${jsonRules}

${example}

${this.getFinalInstructions()}`;
  }

  private static buildDefaultPrompt(
    content: ScrapedContent,
    randomCorrectAnswers: number[] = []
  ): string {
    const base = this.getBaseInstructions();
    const contentSection = this.formatContentSection(content);
    const distribution = this.getRandomAnswerDistributionRules(randomCorrectAnswers);
    const jsonRules = this.getJsonFormatRules();
    const example = this.getExampleStructure();
    return `${base}

${contentSection}

${distribution}

${jsonRules}

${example}

${this.getFinalInstructions()}`;
  }

  private static getBaseInstructions(): string {
    return `You are an expert educator. Generate a **diagram quiz**: each multiple-choice question has **exactly four answer options**, and **each option is a Mermaid diagram** (not plain text).

The learner must identify which diagram correctly represents a concept from the source material. Three diagrams should be **plausible but wrong** (wrong structure, wrong flow, or wrong labels). One diagram must be **correct**.

**DIAGRAM RULES:**
- Use only: \`flowchart\` / \`graph\`, \`sequenceDiagram\`, \`classDiagram\`, or \`erDiagram\`.
- **BANNED diagram types** (will fail to render): \`mindmap\`, \`timeline\`, \`gantt\`, \`pie\`, \`gitGraph\`, \`journey\`, \`sankey\`, \`xychart\`, \`block\`, \`packet\`, \`kanban\`, \`architecture\`. Do NOT use any of these.
- Keep each diagram **compact**: at most ~12 nodes or participants per diagram so it renders reliably.
- **No markdown code fences** inside JSON string values — put raw Mermaid source with newline characters escaped as needed.
- **Do not** use double quotes inside Mermaid node labels; use single quotes or rephrase.
- **NEVER** use forward slashes (\`/\`) inside square-bracket node labels. \`[/text]\` triggers Mermaid trapezoid syntax and causes a lexical error. Write \`[text]\` or use parentheses \`(text)\` instead.
- **NEVER** use backslashes (\`\\\\\`) inside square-bracket node labels for the same reason.
- **NEVER** use \`@\` inside square-bracket node labels — it is a reserved Mermaid token (link ID) and causes a parse error. Write the word out or omit the symbol entirely. E.g. use \`[At symbol]\` or \`[mention]\` instead of \`[@]\`.
- If a label must contain a special character (\`/\`, \`\\\\\`, \`@\`, \`#\`, \`&\`), **quote the label** with double quotes inside the brackets: e.g. \`A["@mention"]\` or \`B["/path"]\`.
- **NEVER** use spaces in \`subgraph\` IDs. A subgraph ID with spaces (e.g. \`subgraph Top Frame\`) will cause a parse error when referenced in an edge. Always use a camelCase or snake_case ID and put the display label in quotes: \`subgraph topFrame["Top Frame"]\`. Reference the ID (\`topFrame\`) in edges, not the label.
- Each of the four diagrams for a question should be **visually comparable** (same diagram type when possible) so the question tests understanding, not diagram style.`;
  }

  private static formatContentSection(content: ScrapedContent): string {
    return `**SOURCE TITLE:** ${content.title}
${content.author ? `**AUTHOR:** ${content.author}` : ''}

**SOURCE CONTENT:**
${content.content}

**TASK:**
Create **5 to 8** questions. For each question, output **exactly 4** Mermaid diagrams in array \`diagrams\` (indices 0–3 = A–D), a **correctAnswer** index (0–3), and a clear **explanation** of why the correct diagram is right and how the others mislead.`;
  }

  private static getRandomAnswerDistributionRules(randomAnswers: number[]): string {
    const letters = randomAnswers.map((i) => String.fromCharCode(65 + i));
    const seq = letters.map((l, idx) => `Q${idx + 1}-${l}`).join(', ');
    return `**CORRECT ANSWER POSITIONS (MANDATORY):**
Use this pattern so answers are not all "A":
${seq}

For question N, option at index matching the letter above must be the factually correct diagram.`;
  }

  private static getJsonFormatRules(): string {
    return `**JSON RULES:**
- Return **only** valid JSON. No markdown outside the JSON.
- **No backticks** in any string value.
- **No unescaped double quotes** inside string values.
- \`diagrams\` must be a string array of length **4** for every question — each string is full Mermaid source.
- \`correctAnswer\` is integer 0, 1, 2, or 3.
- \`explanation\` is required (non-empty string).`;
  }

  private static getExampleStructure(): string {
    return `**REQUIRED SHAPE:**
{
  "title": "Short title for the diagram quiz",
  "questions": [
    {
      "question": "Which diagram best shows X?",
      "diagrams": [
        "flowchart TD\\n  A-->B",
        "flowchart TD\\n  A-->C",
        "flowchart TD\\n  B-->A",
        "flowchart TD\\n  A-->B\\n  B-->D"
      ],
      "correctAnswer": 0,
      "explanation": "Why option A is correct and others are wrong."
    },
    {
      "question": "Which diagram shows the correct stack state?",
      "diagrams": [
        "flowchart BT\\n  subgraph topFrame[\\"Top Frame\\"]\\n    A(op: +)\\n  end\\n  subgraph bottomFrame[\\"Bottom Frame\\"]\\n    B(op: -)\\n  end\\n  bottomFrame --> topFrame",
        "flowchart BT\\n  subgraph topFrame[\\"Top Frame\\"]\\n    A(op: -)\\n  end\\n  subgraph bottomFrame[\\"Bottom Frame\\"]\\n    B(op: +)\\n  end\\n  bottomFrame --> topFrame",
        "flowchart BT\\n  A(op: +)-->B(op: -)",
        "flowchart BT\\n  A(op: -)-->B(op: +)"
      ],
      "correctAnswer": 1,
      "explanation": "Note: subgraph IDs use camelCase (topFrame) with display labels in quotes."
    }
  ]
}`;
  }

  private static getFinalInstructions(): string {
    return `**FINAL CHECK:** Every question has exactly 4 diagrams, valid Mermaid, and a non-empty explanation. Generate the JSON now:`;
  }
}
