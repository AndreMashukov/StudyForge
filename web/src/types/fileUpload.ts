/**
 * File Upload Type Definitions for Text Prompt Feature
 */

// File Upload Constraints
export const FILE_UPLOAD_CONSTRAINTS = {
  MAX_FILES: 5,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB in bytes
  MAX_TOTAL_TOKENS: 200000, // ~800K characters (leaving room for AI response)
  ALLOWED_EXTENSIONS: ['.txt', '.md'],
  ALLOWED_MIME_TYPES: ['text/plain', 'text/markdown'],
  CHARS_PER_TOKEN: 4, // Rough estimate for token counting
} as const;

// Attached File State
export interface IAttachedFile {
  id: string; // Unique identifier
  file: File; // Original File object
  filename: string;
  size: number; // Size in bytes
  content: string; // Read file content
  characterCount: number;
  estimatedTokens: number;
  status: 'reading' | 'ready' | 'error';
  error?: string;
}

// File Validation Result
export interface IFileValidationResult {
  isValid: boolean;
  errors: string[];
}

// Error Messages
export const FILE_UPLOAD_ERRORS = {
  INVALID_FILE_TYPE: 'Only .txt and .md files are supported',
  FILE_TOO_LARGE: 'File size cannot exceed 5MB',
  MAX_FILES_REACHED: 'You can attach up to 5 files',
  CONTEXT_TOO_LARGE: 'Total context size exceeds 200K tokens. Please remove some files.',
  FILE_READ_ERROR: 'Failed to read file. Please try again.',
  DUPLICATE_FILE: 'This file has already been attached',
  EMPTY_FILE: 'File is empty',
} as const;

// Type guards
export const isTextFile = (file: File): boolean => {
  const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  return FILE_UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(extension);
};

export const isMimeTypeValid = (file: File): boolean => {
  return FILE_UPLOAD_CONSTRAINTS.ALLOWED_MIME_TYPES.includes(file.type) || 
         file.type === '';
};

