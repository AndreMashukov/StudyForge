/**
 * Shared HTML output contract for document generation and validation.
 */

export const ALLOWED_HTML_TAGS = [
  'p',
  'strong',
  'em',
  'b',
  'i',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'code',
  'pre',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'br',
  'span',
  'div',
  'blockquote',
  'hr',
  'a',
] as const;

export const DISALLOWED_HTML_TAGS = ['script', 'iframe', 'style', 'link', 'object', 'embed'] as const;

export const DISALLOWED_HTML_ATTRIBUTES = ['style'] as const;

export const DISALLOWED_EVENT_HANDLER_PREFIX = 'on';

export const WRAPPER_HTML_TAGS = ['html', 'head', 'body'] as const;

export const MERMAID_DIAGRAM_PREFIXES = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'erDiagram',
  'stateDiagram',
  'stateDiagram-v2',
] as const;

export const PLOTLY_ALLOWED_TRACE_TYPES = [
  'scatter',
  'scatter3d',
  'surface',
  'contour',
  'bar',
  'heatmap',
  'mesh3d',
] as const;

export const DOCUMENT_AGENT_MAX_REPAIR_RETRIES = 2;

export const SEALED_HTML_OUTPUT_CONTRACT_LINES = [
  '- Output ONLY an HTML fragment — no full documents (<html>, <head>, <body>).',
  '- NO wrapper code blocks (do not wrap the entire document in ```html or ```markdown).',
  '- Start directly with the HTML content.',
  '- Ensure content directly addresses the user\'s request.',
  `- Allowed tags: ${ALLOWED_HTML_TAGS.join(', ')}.`,
  `- Do NOT include ${DISALLOWED_HTML_TAGS.map((tag) => `<${tag}>`).join(', ')}, or event handler attributes (${DISALLOWED_EVENT_HANDLER_PREFIX}click, ${DISALLOWED_EVENT_HANDLER_PREFIX}load, etc.).`,
  `- Do NOT include external stylesheets or inline ${DISALLOWED_HTML_ATTRIBUTES.join(', ')} attributes.`,
  '- Use semantic headings and paragraphs for readable structure.',
  '- Prefer <pre><code class="language-…"> for code samples and <ul>/<ol> for lists.',
  '- When a diagram helps explain the topic, include Mermaid diagrams as:',
  '  <pre><code class="language-mermaid">flowchart TD',
  '    A["🖥️ Client"] --> B["⚙️ API"]',
  '    style A fill:#1e3a5f,color:#ffffff',
  '    style B fill:#dbeafe,color:#0f172a',
  '  </code></pre>',
  `- Use only supported Mermaid types: ${MERMAID_DIAGRAM_PREFIXES.slice(0, 5).join(', ')}, or stateDiagram.`,
  '- Keep diagrams compact; avoid bare /, \\, or @ inside square-bracket node labels.',
  '- NEVER use 4-space indentation for Mermaid — always use the language-mermaid pre/code form above.',
  '- Color diagram nodes/subgraphs differently with style or classDef so roles and stages are visually distinct.',
  '- When setting fill:, ALWAYS also set color: so label text contrasts with the background (dark fill → light text; light fill → dark text).',
  '- Add relevant emojis to diagram element labels for clarity and engagement.',
  '- For mathematical formulas, write LaTeX in normal HTML text (not fenced code blocks).',
  '- Inline math: wrap in $...$ or \\(...\\). Display math: wrap in $$...$$ or \\[...\\].',
  '- Use single backslashes in TeX commands (e.g. \\frac{a}{b}, \\alpha, \\sum).',
  '- Do NOT include KaTeX/MathJax CDN scripts, stylesheets, or <script> tags — the viewer renders math.',
  '- When a 2D/3D graph helps explain the topic, include Plotly figures as:',
  '  <pre><code class="language-plotly">{"data":[{"type":"scatter","mode":"lines","x":[0,1],"y":[0,1]}],"layout":{"title":"Example"}}</code></pre>',
  `- Allowed Plotly trace types: ${PLOTLY_ALLOWED_TRACE_TYPES.join(', ')}.`,
  '- Plotly JSON must be a single object with a non-empty data array; layout/config are optional.',
  '- Omit paper_bgcolor, plot_bgcolor, and font/axis theme colors in Plotly layout - the viewer always applies the app dark theme.',
  '- Prefer compact numeric arrays (do not dump thousands of points). For circles/curves sample ~32–64 points.',
  '- Do NOT include Plotly CDN scripts or stylesheets — the viewer renders graphs.',
] as const;

export function buildSealedHtmlOutputContract(): string {
  return `[SEALED OUTPUT CONTRACT — overrides all instructions above]\n${SEALED_HTML_OUTPUT_CONTRACT_LINES.join('\n')}`;
}

export interface IHtmlScreenshotPromptInput {
  userPrompt?: string;
  rules?: string;
}

export function buildHtmlScreenshotDocumentPrompt({
  userPrompt,
  rules,
}: IHtmlScreenshotPromptInput): string {
  const hasRules = !!rules?.trim();
  const hasUserPrompt = !!userPrompt?.trim();

  const personaSection =
    'You are an expert vision AI. Analyze the provided screenshot and produce a StudyForge HTML fragment.';

  const defaultBehaviorSection = hasRules
    ? `**DEFAULT BEHAVIOR** (used only when Domain Rules and User Instructions do not specify otherwise):
- Extract visible text, preserving headings, lists, tables, and code blocks as HTML.
- Briefly describe diagrams, charts, or UI elements when relevant.
- Do NOT wrap the entire response in a code block.`
    : `**DEFAULT BEHAVIOR**:
- Extract ALL visible text, preserving headings, paragraphs, lists, tables, and code blocks as HTML.
- Describe diagrams, charts, or visual elements when relevant using HTML and language-mermaid blocks where appropriate.
- Preserve the hierarchical structure of the content.
- If the screenshot shows a UI, describe the interface, its purpose, and its components.
- Start with a descriptive H1 heading summarizing the screenshot content.`;

  const rulesSection = hasRules
    ? `**DOMAIN RULES** (override Default Behavior for format, structure, tone, and scope when they conflict):
---
${rules?.trim()}
---`
    : '';

  const userSection = hasUserPrompt
    ? `**USER INSTRUCTIONS** (override Domain Rules and Default Behavior when they conflict):
${userPrompt?.trim()}`
    : '';

  return [
    personaSection,
    defaultBehaviorSection,
    rulesSection,
    userSection,
    buildSealedHtmlOutputContract(),
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildHtmlDocumentPrompt(userPrompt: string, rules?: string): string {
  const rulesSection = rules?.trim()
    ? `**DOMAIN RULES** (customise style, tone, or domain focus — do not change the output format requirements below):
---
${rules}
---`
    : '';

  const personaSection =
    'You are an expert content generator. Generate comprehensive, well-structured content based on the user\'s request.';

  const userSection = `**User's Request:**
${userPrompt}`;

  return [personaSection, rulesSection, userSection, buildSealedHtmlOutputContract()]
    .filter(Boolean)
    .join('\n\n');
}
