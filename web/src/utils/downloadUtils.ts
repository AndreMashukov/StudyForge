/**
 * Triggers a browser download of markdown content as a .md file.
 */
export const downloadMarkdownFile = (content: string, title: string): void => {
  const sanitized = title.replace(/[^a-z0-9]/gi, '_').toLowerCase().replace(/^_+|_+$/g, '');
  const filename = `${sanitized || 'document'}.md`;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
