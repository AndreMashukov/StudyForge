const STYLE_DIRECTIVE_LINE =
  /^\s*(style\s+|classDef\s+|linkStyle\s+|click\s+|class\s+[A-Za-z0-9_]+\s+[A-Za-z0-9_-]+)/i;

const SEMANTIC_FILL_RE =
  /fill\s*:\s*#?(?:f00|ff0000|ef4444|f87171|fca5a5|fecaca|dc2626|b91c1c|0f0|00ff00|22c55e|4ade80|86efac|bbf7d0|ccffcc|90ee90|008000|16a34a|15803d)\b/i;

function stripInlineClassMarkers(line: string): string {
  return line.replace(/\s*:::[A-Za-z0-9_-]+/g, '');
}

export function hasMermaidQuizStyleDirectives(source: string): boolean {
  return source.split('\n').some((line) => STYLE_DIRECTIVE_LINE.test(line) || /:::[A-Za-z0-9_-]+/.test(line));
}

export function hasSemanticMermaidColors(source: string): boolean {
  return SEMANTIC_FILL_RE.test(source);
}

export function extractMermaidFillSignatures(source: string): string[] {
  const fills = source.match(/fill\s*:\s*#[0-9a-fA-F]{3,8}/gi) ?? [];
  return fills.map((fill) => fill.toLowerCase()).sort();
}

export function neutralizeMermaidQuizStyles(source: string): string {
  const lines = source.split('\n');
  const neutralized = lines
    .filter((line) => !STYLE_DIRECTIVE_LINE.test(line))
    .map((line) => stripInlineClassMarkers(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return neutralized;
}
