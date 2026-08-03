/**
 * Encode bare `&` characters that are not already HTML entities.
 */
export function encodeBareAmpersands(htmlFragment: string): string {
  return htmlFragment.replace(/&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;');
}

/**
 * Strip trailing spaces/tabs on each line. LLM output often has them, and
 * html-validate's no-trailing-whitespace rule would otherwise fail generation
 * for a cosmetic issue that does not affect rendering.
 */
export function stripTrailingWhitespace(htmlFragment: string): string {
  return htmlFragment.replace(/[ \t]+$/gm, '');
}

export function normalizeGeneratedHtmlFragment(htmlFragment: string): string {
  const stripped = stripTrailingWhitespace(
    htmlFragment
      .replace(/^```(?:html|markdown)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()
  );

  return encodeBareAmpersands(stripped);
}
