import { ScrapedContent } from '@shared-types';
import {
  buildQuizHintFieldInstruction,
  buildQuizHintJsonRule,
  buildQuizHintExampleLine,
} from './quiz-hint-prompt-builder';

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
    const syntaxRules = this.getDiagramSyntaxRules();
    const jsonRules = this.getJsonFormatRules();
    const example = this.getExampleStructure();
    // Always include the mandatory syntax rules even when custom rules replace the base instructions,
    // so diagram syntax constraints are never silently dropped.
    return `${customRules}

${syntaxRules}

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

${this.getDiagramSyntaxRules()}`;
  }

  private static getDiagramSyntaxRules(): string {
    return DiagramQuizPromptBuilder.getDiagramSyntaxRulesExcerpt();
  }

  /** Public excerpt used by diagram quiz agent repair prompts. */
  static getDiagramSyntaxRulesExcerpt(): string {
    return `**SEALED DIAGRAM SYNTAX RULES (override any domain rule above):**
- Use only: \`flowchart\` / \`graph\`, \`sequenceDiagram\`, \`classDiagram\`, or \`erDiagram\`.
- **BANNED diagram types** (will fail to render): \`mindmap\`, \`timeline\`, \`gantt\`, \`pie\`, \`gitGraph\`, \`journey\`, \`sankey\`, \`xychart\`, \`block\`, \`packet\`, \`kanban\`, \`architecture\`. Do NOT use any of these.
- Keep each diagram **compact**: at most ~12 nodes or participants per diagram so it renders reliably.
- **No markdown code fences** inside JSON string values — put raw Mermaid source with newline characters escaped as needed.
- **Do not** use double quotes inside Mermaid node labels; use single quotes or rephrase.
- **NEVER** use forward slashes (\`/\`) inside square-bracket node labels. \`[/text]\` triggers Mermaid trapezoid syntax and causes a lexical error. Write \`[text]\` or use parentheses \`(text)\` instead.
- **NEVER** use backslashes (\`\\\\\`) inside square-bracket node labels for the same reason.
- **NEVER** use \`@\` inside square-bracket node labels — it is a reserved Mermaid token and causes a parse error. Write the word out instead.
- If a label must contain a special character (\`/\`, \`\\\\\`, \`@\`, \`#\`, \`&\`), **quote the label** with double quotes inside the brackets: e.g. \`A["@mention"]\` or \`B["/path"]\`.
- **NEVER** use spaces in \`subgraph\` IDs. Always use camelCase/snake_case for the ID and put the display label in **square brackets**: \`subgraph topFrame["Top Frame"]\`. Do NOT use parentheses for subgraph labels — \`subgraph Init ('1D DP Array')\` is INVALID syntax; use \`subgraph initArray["1D DP Array"]\` instead.
- **NEVER** use a colon (\`:\`) inside a parenthesis-style node label \`(text)\` — colons inside \`()\` confuse the Mermaid lexer. Use a dash or spell it out: \`(Size - Capacity plus 1)\` instead of \`(Size: Capacity + 1)\`.
- **NEVER** put a bare negative number directly inside a circle node \`((text))\`. \`A((-1))\` causes a parse error because Mermaid tokenizes \`(-\` as an operator. **Always quote it**: \`A(("-1"))\`.
- **Visual styling is encouraged**: use \`style\` / \`classDef\` with a shared neutral palette (e.g. \`fill:#2b6cb0,color:#fff\`) and include relevant emojis in node labels for engagement.
- Apply the **same color palette** across all four diagrams in each question. Never use semantic green, red, or blue to mark correct vs incorrect options.
- When setting \`fill:\`, always set \`color:\` explicitly for readable contrast.
- Each of the four diagrams for a question should be **visually comparable** (same diagram type when possible) so the question tests understanding, not diagram style.
- Do not make the correct answer the only diagram with more nodes, subgraphs, labels, or arrows. All four options should use the same scaffold and be within about 1-2 structural lines of each other.`;
  }

  private static formatContentSection(content: ScrapedContent): string {
    return `**SOURCE TITLE:** ${content.title}
${content.author ? `**AUTHOR:** ${content.author}` : ''}

**SOURCE CONTENT:**
${content.content}

**TASK:**
Create **5 to 8** questions. For each question, output **exactly 4** Mermaid diagrams in array \`diagrams\` (indices 0–3 = A–D), a **correctAnswer** index (0–3), a clear **explanation** of why the correct diagram is right and how the others mislead, and:
${buildQuizHintFieldInstruction('Compare the arrow direction, labels, and missing links before choosing.')}`;
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
- \`explanation\` is required (non-empty string).
- \`knowledge\` is required with \`subjectName\`, \`knowledgeDomainName\`, and \`topicTags\` (1-5 short strings).
${buildQuizHintJsonRule()}`;
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
      "explanation": "Why option A is correct and others are wrong.",
      "knowledge": {
        "subjectName": "Concise subject tested by this question",
        "knowledgeDomainName": "Broader knowledge domain",
        "topicTags": ["specific-topic", "diagram-reasoning"]
      },
      ${buildQuizHintExampleLine('Trace the direction of the arrows before deciding.')}
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
      "explanation": "Note: subgraph IDs use camelCase (topFrame) with display labels in quotes.",
      "knowledge": {
        "subjectName": "Stack state diagrams",
        "knowledgeDomainName": "Programming concepts",
        "topicTags": ["stack-frames", "mermaid-diagrams"]
      },
      ${buildQuizHintExampleLine('Check which stack frame is shown above the other.')}
    }
  ]
}`;
  }

  private static getFinalInstructions(): string {
    return `**FINAL CHECK:** Every question has exactly 4 diagrams, valid Mermaid, a non-empty explanation, and a non-empty hint. Generate the JSON now:`;
  }

  /**
   * Phase 1: compact question plans without Mermaid diagram source.
   */
  static buildDiagramQuizQuestionPlanPrompt(
    content: ScrapedContent,
    additionalPrompt: string | undefined,
    randomCorrectAnswers: number[],
    questionCount: number
  ): string {
    const distribution = this.getRandomAnswerDistributionRules(randomCorrectAnswers.slice(0, questionCount));
    const contentSection = this.formatContentSectionForPlans(content, questionCount);
    const customSection = additionalPrompt?.trim() ? `${additionalPrompt.trim()}\n\n` : '';

    return `${customSection}${this.getBaseInstructionsForPlans()}

${contentSection}

${distribution}

${this.getQuestionPlanJsonRules()}

${this.getQuestionPlanExample(questionCount)}

Generate the JSON now:`;
  }

  /**
   * Phase 2: Mermaid diagrams for a batch of already-planned questions.
   */
  static buildDiagramQuizDiagramBatchPrompt(params: {
    content: ScrapedContent;
    title: string;
    questions: Array<{
      index: number;
      question: string;
      correctAnswer: number;
      optionPlans: [string, string, string, string];
      explanation: string;
    }>;
    strict?: boolean;
  }): string {
    const strictSection = params.strict
      ? `\n**STRICT MODE:** Return ONLY valid JSON. Keep each diagram compact (~8 nodes max). No markdown fences.\n`
      : '';
    const questionBlocks = params.questions
      .map((item) => {
        const labels = ['A', 'B', 'C', 'D'];
        const optionLines = item.optionPlans
          .map((plan, optionIndex) => `    - Option ${labels[optionIndex]} (index ${optionIndex}): ${plan}`)
          .join('\n');
        return `Question index ${item.index}:
  Prompt: ${item.question}
  Correct answer index: ${item.correctAnswer}
  Option plans:
${optionLines}
  Explanation summary: ${item.explanation}`;
      })
      .join('\n\n');

    return `${this.getDiagramSyntaxRules()}${strictSection}

**SOURCE TITLE:** ${params.content.title}

**QUIZ TITLE:** ${params.title}

**TASK:** For each question below, output exactly 4 Mermaid diagram strings in array \`diagrams\` (indices 0–3).
The diagram at \`correctAnswer\` must be factually correct per the source; the other three must be plausible but wrong.
Use the option plans as guidance. Do NOT repeat the question text inside the diagram unless needed as a short label.
All four diagrams for a question must be balanced: same diagram type, same visual scaffold, similar node/edge count, and similar label density. Do not make the correct answer longer or more detailed than the distractors; wrong options should be created by changing direction, labels, missing links, or relationships inside the same-sized scaffold.

${questionBlocks}

${this.getDiagramBatchJsonRules()}

${this.getDiagramBatchExample()}

Generate the JSON now:`;
  }

  private static getBaseInstructionsForPlans(): string {
    return `You are an expert educator planning a **diagram quiz**.
Each future question will have four Mermaid diagram answer options. In this step, plan the questions only — **do not** output Mermaid source code.

For each question provide:
- \`question\`: the stem shown to the learner
- \`correctAnswer\`: integer 0–3 (which option will be correct)
- \`optionPlans\`: array of exactly 4 short strings describing what each diagram option should depict
- \`explanation\`: why the correct option is right and others mislead
- \`hint\`: short non-spoiler clue
- \`knowledge\`: subjectName, knowledgeDomainName, topicTags (1–5 strings)`;
  }

  private static formatContentSectionForPlans(
    content: ScrapedContent,
    questionCount: number
  ): string {
    return `**SOURCE TITLE:** ${content.title}
${content.author ? `**AUTHOR:** ${content.author}` : ''}

**SOURCE CONTENT:**
${content.content}

**TASK:** Create exactly **${questionCount}** questions. Do NOT include a \`diagrams\` field in this response.`;
  }

  private static getQuestionPlanJsonRules(): string {
    return `**JSON RULES:**
- Return **only** valid JSON. No markdown outside the JSON.
- **No backticks** in any string value.
- **No unescaped double quotes** inside string values.
- \`optionPlans\` must be a string array of length **4**.
- \`correctAnswer\` is integer 0, 1, 2, or 3.
- \`explanation\` and \`hint\` are required non-empty strings.
- \`knowledge\` is required with \`subjectName\`, \`knowledgeDomainName\`, and \`topicTags\`.
${buildQuizHintJsonRule()}`;
  }

  private static getQuestionPlanExample(questionCount: number): string {
    return `**REQUIRED SHAPE:**
{
  "title": "Short title for the diagram quiz",
  "questions": [
    {
      "question": "Which diagram best shows X?",
      "correctAnswer": 0,
      "optionPlans": [
        "Correct flow from A to B with labeled steps",
        "Reversed arrow direction between A and B",
        "Missing intermediate node between A and B",
        "Extra invalid branch from A to D"
      ],
      "explanation": "Why option A is correct and others are wrong.",
      "knowledge": {
        "subjectName": "Concise subject tested by this question",
        "knowledgeDomainName": "Broader knowledge domain",
        "topicTags": ["specific-topic", "diagram-reasoning"]
      },
      ${buildQuizHintExampleLine('Compare arrow direction and labels before choosing.')}
    }
  ]
}

Return exactly ${questionCount} items in \`questions\`.`;
  }

  private static getDiagramBatchJsonRules(): string {
    return `**JSON RULES:**
- Return **only** valid JSON. No markdown outside the JSON.
- Top-level object with \`questions\` array only.
- Each item must include \`index\` (the question index from the prompt) and \`diagrams\` (string array length 4).
- Each diagram string is raw Mermaid source with newlines escaped as needed.
- **No backticks** inside JSON string values.`;
  }

  private static getDiagramBatchExample(): string {
    return `**REQUIRED SHAPE:**
{
  "questions": [
    {
      "index": 0,
      "diagrams": [
        "flowchart TD\\n  A-->B",
        "flowchart TD\\n  B-->A",
        "flowchart TD\\n  A-->C",
        "flowchart TD\\n  A-->B\\n  B-->D"
      ]
    }
  ]
}`;
  }
}
