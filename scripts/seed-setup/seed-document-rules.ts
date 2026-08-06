/**
 * Document-generation rules ported from sf-next-supabase (local Supabase `rules` table).
 * Kept as StudyForge seed/source-of-truth for HTML + Plotly + math contracts.
 */

export interface SeedDocumentRuleDefinition {
  id: string;
  name: string;
  description: string;
  content: string;
  tags: string[];
  applicableTo: Array<'prompt' | 'upload' | 'scraping'>;
  isDefault: boolean;
  color: string;
}

export const DOC_HTML_FORMAT_CONTENT = `## 1. Pure HTML Format
* Output strictly HTML content.
* Do not wrap the document in code blocks.
* Prefer direct technical content. Short pedagogical framing is allowed when a learning-format rule is selected; avoid assistant chatter about the generation process.
* Start directly with the document title.

## 2. Content Validation
* Generate at least 1000 words, excluding tables, unless another selected format rule sets a different length target.
* Include 1 to 2 properly formatted HTML tables when helpful, unless another selected format rule does not require tables.
* Ensure all HTML syntax is perfectly formatted.

## 3. Quality Standards
* Write in a professional technical documentation style.
* Use highly accurate technical information.
* Provide practical and actionable insights.
* Focus entirely on addressing the user prompt.

## 4. Document Structure
* Default sequential structure when no other selected format rule defines structure: Glossary → Core Concepts → Examples → Summary.
* If another selected rule defines a document structure (for example Linear Algebra Learning Document Format or Brief How-To Format), follow that rule's structure instead.
* Use appropriate and hierarchical heading levels (\`<h1>\`–\`<h3>\`).
* Maintain consistent typography and formatting throughout the document.

## 5. Code Samples
* Write all code examples in Python unless the user prompt specifies another language.
* Wrap every code block as: \`<pre><code class="language-python">...</code></pre>\`
* Use language-typescript, language-javascript, language-sql, or language-bash only when that language is required by the topic or user prompt.
* Do not invent colored \`<span>\` styles for syntax highlighting.

## 6. Mermaid Diagrams
* When a diagram improves understanding (architecture, flows, sequences, state), include 1–2 Mermaid diagrams.
* Wrap every Mermaid diagram as: \`<pre><code class="language-mermaid">...</code></pre>\`
* Use only supported types: flowchart/graph, sequenceDiagram, classDiagram, erDiagram, or stateDiagram.
* Keep diagrams compact and readable.
* Do not use markdown fences (\`\`\`mermaid); always use the HTML pre/code form above.
* Prefer diagrams in Core Concepts or Examples sections.
* Color diagram nodes and subgraphs differently with style or classDef so roles and stages are visually distinct.
* When setting a fill color, ALWAYS also set color: so label text contrasts with the background (dark fill → light text; light fill → dark text). Example: \`style A fill:#1e3a5f,color:#ffffff\` or \`style B fill:#dbeafe,color:#0f172a\`.
* Add relevant emojis to diagram element labels for clarity and engagement (for example \`A["🖥️ Client"]\`, \`B["⚙️ API"]\`, \`C["🗄️ Database"]\`).

## Mermaid Invalid Characters (required)

StudyForge rejects Mermaid diagrams that put bare \`/\`, \`\\\`, or \`@\` inside square-bracket node labels (e.g. \`A[foo/bar]\`, \`B[user@host]\`). Generation fails if this happens.

Rules:
- NEVER put bare \`/\`, \`\\\`, or \`@\` inside \`[...]\` node labels.
- Prefer quoted labels and reword paths/emails: \`A["S3 bucket path"]\`, \`B["user at example.com"]\`, \`C["API Gateway then Lambda"]\`.
- Spell out symbols when needed: use "slash", "at", "backslash", or replace with words/dashes (\`prod-api\`, \`us-east-1\`).
- Do not put ARNs, URLs, file paths, or email addresses inside \`[...]\` labels. Summarize them in plain words instead.
- Parenthesis / stadium / circle shapes still must avoid those characters in the label text when wrapped in square brackets.
- Allowed diagram types only: flowchart/graph, sequenceDiagram, classDiagram, erDiagram, stateDiagram (not mindmap, timeline, C4, stateDiagram-v2 unless a separate rule explicitly allows it).
`;

export const WEB_GRAPH_RENDERING_CONTENT = `# Rendering 2D/3D Graphs on the Web

When educational content benefits from a plot, embed an interactive Plotly figure using an HTML code block. The StudyForge viewer renders these client-side — do not load Plotly CDN scripts.

## Format

Use this exact wrapper:

\`\`\`html
<pre><code class="language-plotly">{
  "data": [ /* traces */ ],
  "layout": { /* optional */ },
  "config": { /* optional */ }
}</code></pre>
\`\`\`

Rules:
- The code block language MUST be \`plotly\` (alias \`graph\` is also accepted by the viewer).
- Content MUST be a single JSON object (not markdown, not JavaScript).
- \`data\` is required and must be a non-empty array of traces.
- \`layout\` and \`config\` are optional.
- Allowed trace types only: \`scatter\`, \`scatter3d\`, \`surface\`, \`contour\`, \`bar\`, \`heatmap\`, \`mesh3d\`.
- Keep arrays compact (prefer 32–64 sample points for curves). Do not dump thousands of points.
- Omit paper_bgcolor, plot_bgcolor, and font/axis theme colors in layout — the viewer applies the app dark theme.
- Do NOT include \`<script>\`, CDN links, or Plotly imports — the viewer owns rendering.

## Examples

### 2D unit circle (L₂ ball)

\`\`\`html
<pre><code class="language-plotly">{"data":[{"type":"scatter","mode":"lines","name":"L2 unit ball","x":[1,0.707,0,-0.707,-1,-0.707,0,0.707,1],"y":[0,0.707,1,0.707,0,-0.707,-1,-0.707,0]}],"layout":{"title":"L₂ unit ball","xaxis":{"title":"x","scaleanchor":"y","scaleratio":1},"yaxis":{"title":"y"}}}</code></pre>
\`\`\`

### 3D vector

\`\`\`html
<pre><code class="language-plotly">{"data":[{"type":"scatter3d","mode":"lines+markers","name":"v","x":[0,3],"y":[0,-4],"z":[0,1],"line":{"width":6},"marker":{"size":3}}],"layout":{"title":"Vector (3, -4, 1)","scene":{"xaxis":{"title":"x"},"yaxis":{"title":"y"},"zaxis":{"title":"z"}}}}</code></pre>
\`\`\`

## When to include graphs

- Geometric intuition (unit balls, projections, subspaces)
- Vector arrows in 2D/3D
- Function curves (activations, loss vs epoch with small arrays)
- Contours / surfaces for optimization intuition

Prefer graphs over long prose when a picture communicates the idea faster. Always accompany a graph with a short caption in surrounding HTML (heading or paragraph).
`;

export const WEB_MATH_FORMULA_RENDERING_CONTENT = `# Rendering Math Formulas on the Web

When educational content includes mathematical formulas, emit LaTeX delimiters in normal HTML text. The StudyForge viewer renders them with KaTeX — do NOT load KaTeX/MathJax CDN scripts, stylesheets, or \`<script>\` tags.

## Delimiters
- Inline math: \`$...$\` or \`\\(...\\)\`
- Display math: \`$$...$$\` or \`\\[...\\]\`
- Use single backslashes in TeX commands (e.g. \`\\frac{a}{b}\`, \`\\alpha\`, \`\\sum\`).

## Best practices
- Prefer semantic delimiters (\`\\(...\\)\`, \`\\[...\\]\`) when dollar signs may conflict with currency.
- Escape literal dollar signs in non-math text as \`\\$\`.
- Keep long equations readable; the viewer scrolls overflow.
- Do NOT wrap formulas in fenced code blocks.
- Do NOT include KaTeX/MathJax CDN tags — the viewer owns rendering.

## Graphs (see also Web Graph Rendering)
When a figure helps, embed Plotly JSON in \`<pre><code class="language-plotly">...</code></pre>\`. Allowed types: scatter, scatter3d, surface, contour, bar, heatmap, mesh3d. Do not load CDN scripts.
`;

export const MATH_STUDY_DOCUMENT_FORMATTING_CONTENT = `# Math Study Document Formatting

When creating mathematical study documents, structure the content to maximize readability and comprehension:

- **Use KaTeX-ready LaTeX:** Emit formulas with \`$...$\` / \`$$...$$\` or \`\\(...\\)\` / \`\\[...\\]\` in normal HTML text. Do not load KaTeX/MathJax CDN tags.
- **Isolate Formulas:** Prefer display math on its own line for important equations. Do not bury key equations inside dense paragraphs without delimiters.
- **Standardize Notation:** Use universally recognized mathematical notation for all equations and expressions.
- **Define All Variables:** Immediately after introducing a formula, provide a bulleted list that defines every variable, constant, and symbol used.
- **Show Step-by-Step Solutions:** When demonstrating how to use a formula, break the calculation down into clearly numbered steps from the initial equation to the final answer.
- **Include Practice Examples:** Provide at least one fully solved practice problem for every new formula introduced.
- **Emphasize Terminology:** Apply \`<strong>\` formatting to new mathematical terms, theorems, and foundational concepts upon their first mention.
- **Prefer graphs when helpful:** Use Web Graph Rendering (\`language-plotly\` blocks) for geometric intuition.
`;

export const TECHNICAL_DOCUMENTATION_GENERATOR_HTML_CONTENT = `Act as a technical documentation expert to generate comprehensive, well-structured HTML learning documents based on user prompts. Follow these requirements precisely.

CONTENT REQUIREMENTS:
1. Minimum Length: 1000 words (excluding tables), unless another selected format rule sets a different length target.
2. Tables: Include 1-2 well-formatted HTML tables (\`<table>\`, \`<thead>\`, \`<tbody>\`, \`<tr>\`, \`<th>\`, \`<td>\`) when helpful.
3. Code Examples: Include code examples if relevant. Wrap them as \`<pre><code class="language-…">...</code></pre>\` with practical comments.
4. Depth and Clarity: Provide detailed explanations with technical accuracy. Write in a clear, professional technical writing style.
5. Diagrams / math / plots: When helpful, include Mermaid (\`language-mermaid\`), LaTeX delimiters, and Plotly (\`language-plotly\`) per the platform HTML contract. Never load CDN scripts.

REQUIRED DOCUMENT STRUCTURE (default when no other format rule wins):
Follow this exact structure with HTML headings:

<h1>[Document Title]</h1>

<h2>Glossary</h2>
- Define key terms and concepts used throughout the document.
- Include 5-10 essential terms with clear, concise definitions.

<h2>Core Concepts</h2>
- Provide comprehensive explanations of fundamental concepts (400-600 words).
- Break down complex ideas into digestible subsections (\`<h3>\`).
- Include real-world context and applications.

<h2>Examples</h2>
- Provide practical, concrete examples demonstrating the concepts (200-400 words).
- Include relevant code snippets and/or diagrams/plots when they clarify the idea.
- Explain each example thoroughly.

<h2>Summary</h2>
- Recap key takeaways from the document (100-200 words).
- Highlight the most important points.
- Provide actionable insights or next steps.

CRITICAL OUTPUT REQUIREMENTS:
1. Pure HTML fragment: Output ONLY HTML content. Do NOT wrap the entire document in markdown or code fences. Start directly with the document title (\`<h1>\`).
2. No conversational filler or assistant meta-commentary.
3. Quality Standards: Write in a professional technical style, use accurate information, provide practical insights, and directly address the user prompt.
`;

export const SEED_DOCUMENT_RULES: SeedDocumentRuleDefinition[] = [
  {
    id: 'e2e-doc-html-format',
    name: 'Doc HTML Format',
    description:
      'HTML-first document format: structure, tables, code samples, and Mermaid diagrams for StudyForge learning docs.',
    content: DOC_HTML_FORMAT_CONTENT,
    tags: ['document', 'html', 'format', 'mermaid'],
    applicableTo: ['prompt', 'upload', 'scraping'],
    isDefault: true,
    color: 'blue',
  },
  {
    id: 'e2e-web-graph-rendering',
    name: 'Web Graph Rendering',
    description:
      'Guidelines for embedding interactive 2D/3D Plotly graphs in HTML documents.',
    content: WEB_GRAPH_RENDERING_CONTENT,
    tags: ['document', 'html', 'plotly', 'graphs'],
    applicableTo: ['prompt', 'upload', 'scraping'],
    isDefault: true,
    color: 'indigo',
  },
  {
    id: 'e2e-web-math-formula-rendering',
    name: 'Web Math Formula Rendering',
    description:
      'Guidelines for rendering mathematical formulas with LaTeX delimiters (KaTeX viewer).',
    content: WEB_MATH_FORMULA_RENDERING_CONTENT,
    tags: ['document', 'html', 'math', 'latex', 'katex'],
    applicableTo: ['prompt', 'upload', 'scraping'],
    isDefault: true,
    color: 'purple',
  },
];
