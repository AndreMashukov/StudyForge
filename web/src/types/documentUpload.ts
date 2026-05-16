export const DOCUMENT_UPLOAD_CONSTRAINTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  ALLOWED_EXTENSIONS: ['.pdf', '.docx', '.txt', '.md', '.csv', '.pptx', '.epub'],
  ACCEPT: '.pdf,.docx,.txt,.md,.csv,.pptx,.epub',
  TYPE_LABELS: {
    '.pdf': 'PDF',
    '.docx': 'DOCX',
    '.txt': 'TXT',
    '.md': 'MD',
    '.csv': 'CSV',
    '.pptx': 'PPTX',
    '.epub': 'EPUB',
  },
} as const;

export type DocumentUploadExtension = typeof DOCUMENT_UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS[number];

export function getDocumentUploadExtension(filename: string): DocumentUploadExtension | null {
  const extension = `.${filename.split('.').pop()?.toLowerCase() || ''}`;
  return DOCUMENT_UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(extension as DocumentUploadExtension)
    ? extension as DocumentUploadExtension
    : null;
}
