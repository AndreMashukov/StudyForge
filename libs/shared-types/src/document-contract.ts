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
  '- Do NOT include Mermaid diagrams, Plotly graphs, or mathematical LaTeX unless a selected domain rule explicitly asks for them.',
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
- Extract visible text/code from the screenshot.
- Immediately apply Domain Rules to that content. Extraction alone is not enough.
- If Domain Rules require annotated text / Jyutping / translations, every applicable Chinese sentence MUST use that format in the output.
- Preserve code blocks and non-Chinese tokens; transform the prose according to Domain Rules.
- Do NOT invent a comprehensive learning guide, glossary, or tutorial unless Domain Rules ask for it.
- Do NOT wrap the entire response in a code block.`
    : `**DEFAULT BEHAVIOR**:
- Extract ALL visible text, preserving headings, paragraphs, lists, tables, and code blocks as HTML.
- Preserve the hierarchical structure of the content.
- If the screenshot shows a UI, describe the interface, its purpose, and its components.
- Start with a descriptive H1 heading summarizing the screenshot content.`;

  const rulesSection = hasRules
    ? `**DOMAIN RULES** (primary task — mandatory; override Default Behavior):
---
${rules?.trim()}
---
If these rules describe a text transformation (for example Cantonese annotation), the output MUST be the transformed annotated content, not a plain OCR extract.`
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
  const hasRules = !!rules?.trim();
  const rulesSection = hasRules
    ? `**DOMAIN RULES** (primary task and output structure — follow these over generic learning-document defaults):
---
${rules}
---`
    : '';

  const personaSection = hasRules
    ? 'You are an expert content generator. Apply the Domain Rules to the user\'s request. Do not invent a comprehensive learning guide, glossary, or tutorial unless the Domain Rules ask for it.'
    : 'You are an expert content generator. Generate comprehensive, well-structured content based on the user\'s request.';

  const userSection = `**User's Request:**
${userPrompt}`;

  return [personaSection, rulesSection, userSection, buildSealedHtmlOutputContract()]
    .filter(Boolean)
    .join('\n\n');
}
