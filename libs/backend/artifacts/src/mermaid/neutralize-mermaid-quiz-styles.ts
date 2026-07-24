/** Neutral palette from prod diagram_quiz rules — not a semantic correct/incorrect hint. */
export const NEUTRAL_MERMAID_FILL = '#2b6cb0';
export const NEUTRAL_MERMAID_TEXT = '#ffffff';

const SEMANTIC_FILL_BLOCK =
  /fill\s*:\s*#?(?:f00|ff0000|ef4444|f87171|fca5a5|fecaca|dc2626|b91c1c|0f0|00ff00|22c55e|4ade80|86efac|bbf7d0|ccffcc|90ee90|008000|16a34a|15803d)\b(?:\s*,\s*color\s*:\s*#[0-9a-fA-F]{3,8})?/gi;

const ANY_MERMAID_FILL =
  /fill\s*:\s*#[0-9a-fA-F]{3,8}(?:\s*,\s*color\s*:\s*#[0-9a-fA-F]{3,8})?/gi;

export function hasSemanticMermaidColors(source: string): boolean {
  return /fill\s*:\s*#?(?:f00|ff0000|ef4444|f87171|fca5a5|fecaca|dc2626|b91c1c|0f0|00ff00|22c55e|4ade80|86efac|bbf7d0|ccffcc|90ee90|008000|16a34a|15803d)\b/i.test(
    source
  );
}

export function extractMermaidFillSignatures(source: string): string[] {
  const fills = source.match(/fill\s*:\s*#[0-9a-fA-F]{3,8}/gi) ?? [];
  return fills.map((fill) => fill.toLowerCase()).sort();
}

function replaceSemanticFillValues(source: string): string {
  return source.replace(
    SEMANTIC_FILL_BLOCK,
    `fill:${NEUTRAL_MERMAID_FILL},color:${NEUTRAL_MERMAID_TEXT}`
  );
}

/**
 * Rewrites semantic green/red "answer hint" fills to a shared neutral palette.
 * Keeps styling, classDef, emojis, and non-semantic colors intact.
 */
export function neutralizeMermaidQuizStyles(source: string): string {
  return replaceSemanticFillValues(source).replace(/\n{3,}/g, '\n\n').trim();
}

/** Forces every explicit fill to the shared neutral quiz palette (all options match). */
export function enforceUniformMermaidQuizPalette(source: string): string {
  return source
   .replace(ANY_MERMAID_FILL, `fill:${NEUTRAL_MERMAID_FILL},color:${NEUTRAL_MERMAID_TEXT}`)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
