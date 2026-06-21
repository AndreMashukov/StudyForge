/**
 * Keep in sync with functions/src/services/mermaid/neutralize-mermaid-quiz-styles.ts
 */

const NEUTRAL_MERMAID_FILL = '#2b6cb0';
const NEUTRAL_MERMAID_TEXT = '#ffffff';

const SEMANTIC_FILL_BLOCK =
  /fill\s*:\s*#?(?:f00|ff0000|ef4444|f87171|fca5a5|fecaca|dc2626|b91c1c|0f0|00ff00|22c55e|4ade80|86efac|bbf7d0|ccffcc|90ee90|008000|16a34a|15803d)\b(?:\s*,\s*color\s*:\s*#[0-9a-fA-F]{3,8})?/gi;

export function neutralizeMermaidQuizStyles(source: string): string {
  return source
    .replace(
      SEMANTIC_FILL_BLOCK,
      `fill:${NEUTRAL_MERMAID_FILL},color:${NEUTRAL_MERMAID_TEXT}`
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
