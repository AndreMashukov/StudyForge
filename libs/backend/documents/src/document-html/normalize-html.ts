/**
 * Encode bare `&` characters that are not already HTML entities.
 */
export function encodeBareAmpersands(htmlFragment: string): string {
  return htmlFragment.replace(/&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;');
}

export function normalizeGeneratedHtmlFragment(htmlFragment: string): string {
  const stripped = htmlFragment
    .replace(/^```(?:html|markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  return encodeBareAmpersands(stripped);
}
