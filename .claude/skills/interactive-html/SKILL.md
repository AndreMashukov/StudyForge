---
name: interactive-html
description: >-
  Generate self-contained interactive HTML explainers for features, files, or
  architecture. Includes Mermaid diagrams, PNG illustrations, quizzes, and
  syntax-highlighted code from real source files. Use when the user asks for
  interactive HTML, architecture walkthroughs, feature explainers, or
  references interactive-html.doc.md.
---

# Interactive HTML Explainer

Produce a **single self-contained HTML file** (plus an `images/` folder) that teaches a feature, file, or architecture. Open it directly in a browser — no build step.

## When to use

- User asks to explain a feature, refactor, or file interactively
- Task docs need a visual companion under `docs/tasks/`
- User references `.cursor/prompt/interactive-html.doc.md`

## Output location

Place artifacts next to the related task doc:

```
docs/tasks/YYYY-MM/<task-slug>/
├── <topic>.html          # main explainer
└── images/               # PNG assets referenced by the HTML
    └── *.png
```

Name the HTML after the topic (e.g. `rsc-architecture.html`, `model-settings-panel-flows.html`).

## Required content

1. **Interactive HTML** — tabbed or sidebar navigation; clickable sections that reveal detail (route pickers, flow toggles, etc.)
2. **PNG images** — generate diagrams/illustrations with the image tool; save under `./images/` and reference with relative paths
3. **Mermaid diagrams** — sequence/flowchart/state diagrams for architecture and data flows
4. **Quizzes** — 4–6 multiple-choice questions with instant feedback and a score summary
5. **Real code snippets** — copy from actual source files; syntax-highlighted TypeScript via highlight.js (`language-typescript`); show file path in a header bar; tag each block **Server** / **Client** / **API** where relevant. Prefer a dedicated **Code** tab plus inline snippets in flow/architecture sections.

## Tech stack (CDN, no bundler)

```html
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github-dark.min.css">
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/highlight.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/languages/typescript.min.js"></script>
```

Init at bottom of `<body>`:

```javascript
mermaid.initialize({ startOnLoad: true, theme: 'dark', securityLevel: 'loose' });
hljs.configure({ ignoreUnescapedHTML: true });
hljs.highlightAll();
```

Escape `<` / `>` in code blocks as `&lt;` / `&gt;` when embedded in HTML.

## Visual design

Match StudyForge dark tokens:

| Token | Value | Usage |
|-------|-------|-------|
| background | `#0a0a0a` | page bg |
| card | `#111111` | cards, tab bar |
| border | `#27272a` | borders |
| primary | `#8b5cf6` | accents, active tab |
| server | `#22c55e` | RSC / server badge |
| client | `#3b82f6` | client component badge |
| api | `#f59e0b` | route handler / callable badge |

Include a legend when Server / Client / API boundaries apply.

## Recommended tab structure

Adapt labels to the feature; typical set:

| Tab | Purpose |
|-----|---------|
| Overview | What changed, key principles, hero PNG |
| Map / Flows | Interactive route or flow explorer + Mermaid |
| Code | Full snippets with path + boundary badge |
| Quiz | Comprehension check |

Use `<button class="tab" data-panel="…">` + `<section id="…" class="panel">` with a small JS tab switcher.

## Code block pattern

```html
<div class="code-block">
  <div class="code-file">
    <span>admin/src/app/…/page.tsx</span>
    <span class="badge badge-server">Server</span>
  </div>
  <pre><code class="language-typescript">…escaped TS…</code></pre>
</div>
```

Badge classes: `badge-server`, `badge-client`, `badge-api`.

Read snippets from the repo — do not invent APIs or paths.

## Mermaid

Use `<pre class="mermaid">` blocks. Prefer `flowchart`, `sequenceDiagram`, or `stateDiagram-v2`. Keep node labels short; quote paths with special chars.

## PNG generation

1. Identify 1–3 diagrams that benefit from illustration (boundaries, UI mock, before/after)
2. Generate with the image tool; save as `docs/tasks/…/images/<name>.png`
3. Reference: `<img src="./images/<name>.png" alt="…">` with a caption

## Quiz pattern

```html
<div class="quiz-q" data-answer="b">
  <strong>1. Question text</strong>
  <div class="quiz-options">
    <label class="quiz-option"><input type="radio" name="q1" value="a"> …</label>
    …
  </div>
  <div class="quiz-feedback" data-for="q1"></div>
</div>
<button class="btn" id="grade-quiz">Check answers</button>
<div class="score-box" id="quiz-score" hidden></div>
```

Grade script: compare selected radio to `data-answer`, highlight correct/wrong, show per-question explanations object, display `Score: N / M`.

Questions must test understanding of **this** feature — not generic React trivia.

## Workflow

1. Read the feature files and task context
2. Plan tabs, diagrams, and quiz questions
3. Generate PNGs → `images/`
4. Write the HTML with real snippets, Mermaid, quiz, and tab JS
5. Open the file locally to verify tabs, Mermaid render, highlight.js, and image paths

## Reference examples

Study these before authoring (patterns vary by layout — tabs vs sidebar):

- `docs/tasks/2026-05/19-admin-refactor/model-settings-panel-flows.html` — sidebar nav, mutation flows
- `docs/tasks/2026-05/15-admin-app/rsc-architecture.html` — RSC boundaries
- `docs/tasks/2026-06/05-provider-selection/rsc-architecture.html` — tabs, Code tab, quiz, PNG + Mermaid

## Do not

- Add a build step, npm deps, or framework runtime
- Use MUI or external CSS frameworks
- Fabricate code that does not exist in the repo
- Ship quizzes without explanations on wrong answers
