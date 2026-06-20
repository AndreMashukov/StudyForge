/**
 * Keep in sync with functions/src/services/mermaid/neutralize-mermaid-quiz-styles.ts
 */

const STYLE_DIRECTIVE_LINE =
  /^\s*(style\s+|classDef\s+|linkStyle\s+|click\s+|class\s+[A-Za-z0-9_]+\s+[A-Za-z0-9_-]+)/i;

function stripInlineClassMarkers(line: string): string {
  return line.replace(/\s*:::[A-Za-z0-9_-]+/g, '');
}

export function neutralizeMermaidQuizStyles(source: string): string {
  const lines = source.split('\n');
  return lines
    .filter((line) => !STYLE_DIRECTIVE_LINE.test(line))
    .map((line) => stripInlineClassMarkers(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
