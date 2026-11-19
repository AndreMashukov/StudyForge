/**
 * Triggers a browser download of a Blob under the given file name.
 * The object URL is revoked on the next tick so Safari does not cancel the download.
 */
export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

/**
 * Triggers a browser download of markdown content as a .md file.
 */
export const downloadMarkdownFile = (content: string, title: string): void => {
  const sanitized = title.replace(/[^a-z0-9]/gi, '_').toLowerCase().replace(/^_+|_+$/g, '');
  const filename = `${sanitized || 'document'}.md`;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, filename);
};
