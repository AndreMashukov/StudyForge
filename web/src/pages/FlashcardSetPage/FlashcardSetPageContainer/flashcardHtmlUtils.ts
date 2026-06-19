/**
 * Escape HTML special characters in plain text.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert plain text to a simple HTML fragment for legacy flashcards.
 * Preserves paragraph breaks (double newline) and line breaks (single newline).
 */
export function textToHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const paragraphs = trimmed.split(/\n\s*\n/);
  return paragraphs
    .map((paragraph) => {
      const withBreaks = escapeHtml(paragraph).replace(/\n/g, '<br />');
      return `<p>${withBreaks}</p>`;
    })
    .join('');
}

/**
 * Resolve display HTML: prefer explicit HTML field, fall back to plain-text conversion.
 */
export function resolveFlashcardHtml(html: string | undefined, text: string | undefined): string {
  if (html?.trim()) return html;
  if (text?.trim()) return textToHtml(text);
  return '';
}
