/**
 * File Upload Utility Functions for Text Prompt Feature
 */

import { FILE_UPLOAD_CONSTRAINTS, FILE_UPLOAD_ERRORS, IAttachedFile, IFileValidationResult } from '../types/fileUpload';

/**
 * Validate file type by checking extension and MIME type
 * @param file - File to validate
 * @returns Validation result
 */
export function validateFileType(file: File): IFileValidationResult {
  const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  const errors: string[] = [];

  // Check extension
  if (!FILE_UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(extension)) {
    errors.push(FILE_UPLOAD_ERRORS.INVALID_FILE_TYPE);
  }

  // Check MIME type (if provided)
  if (file.type && !FILE_UPLOAD_CONSTRAINTS.ALLOWED_MIME_TYPES.includes(file.type)) {
    errors.push(FILE_UPLOAD_ERRORS.INVALID_FILE_TYPE);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate file size
 * @param file - File to validate
 * @param maxSize - Maximum size in bytes
 * @returns Validation result
 */
export function validateFileSize(file: File, maxSize: number = FILE_UPLOAD_CONSTRAINTS.MAX_FILE_SIZE): IFileValidationResult {
  const errors: string[] = [];

  if (file.size > maxSize) {
    errors.push(FILE_UPLOAD_ERRORS.FILE_TOO_LARGE);
  }

  if (file.size === 0) {
    errors.push(FILE_UPLOAD_ERRORS.EMPTY_FILE);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Read file content as text
 * @param file - File to read
 * @returns Promise that resolves with file content
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error(FILE_UPLOAD_ERRORS.FILE_READ_ERROR));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Calculate estimated token count for text
 * Uses rough approximation: 1 token ≈ 4 characters
 * @param text - Text to count tokens for
 * @returns Estimated token count
 */
export function calculateTokenCount(text: string): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / FILE_UPLOAD_CONSTRAINTS.CHARS_PER_TOKEN);
}

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Generate unique file ID
 * @returns Unique identifier string
 */
export function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate total context size across all files
 * @param files - Array of attached files
 * @returns Validation result
 */
export function validateTotalContextSize(files: IAttachedFile[]): IFileValidationResult {
  const errors: string[] = [];
  
  const totalTokens = files.reduce((sum, file) => sum + file.estimatedTokens, 0);
  
  if (totalTokens > FILE_UPLOAD_CONSTRAINTS.MAX_TOTAL_TOKENS) {
    errors.push(FILE_UPLOAD_ERRORS.CONTEXT_TOO_LARGE);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if file is a duplicate based on name and size
 * @param file - File to check
 * @param existingFiles - Array of already attached files
 * @returns True if duplicate exists
 */
export function isDuplicateFile(file: File, existingFiles: IAttachedFile[]): boolean {
  return existingFiles.some(
    existing => existing.filename === file.name && existing.size === file.size
  );
}

/**
 * Validate file completely (type, size, duplicates)
 * @param file - File to validate
 * @param existingFiles - Array of already attached files
 * @returns Validation result with all errors
 */
export function validateFile(file: File, existingFiles: IAttachedFile[]): IFileValidationResult {
  const errors: string[] = [];
  
  // Check file type
  const typeValidation = validateFileType(file);
  if (!typeValidation.isValid) {
    errors.push(...typeValidation.errors);
  }
  
  // Check file size
  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.isValid) {
    errors.push(...sizeValidation.errors);
  }
  
  // Check for duplicates
  if (isDuplicateFile(file, existingFiles)) {
    errors.push(FILE_UPLOAD_ERRORS.DUPLICATE_FILE);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Process and read a file into IAttachedFile format
 * @param file - File to process
 * @returns Promise that resolves with processed file data
 */
export async function processFile(file: File): Promise<Omit<IAttachedFile, 'id'>> {
  try {
    const content = await readFileAsText(file);
    const characterCount = content.length;
    const estimatedTokens = calculateTokenCount(content);
    
    return {
      file,
      filename: file.name,
      size: file.size,
      content,
      characterCount,
      estimatedTokens,
      status: 'ready',
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : FILE_UPLOAD_ERRORS.FILE_READ_ERROR);
  }
}

/**
 * Convert IAttachedFile array to IFileContent array for API
 * @param files - Array of attached files
 * @returns Array of file content objects for API
 */
export function convertToFileContent(files: IAttachedFile[]): Array<{
  filename: string;
  content: string;
  size: number;
  type: 'text/plain' | 'text/markdown';
}> {
  return files
    .filter(file => file.status === 'ready' && file.content)
    .map(file => ({
      filename: file.filename,
      content: file.content,
      size: file.size,
      type: file.filename.endsWith('.md') ? 'text/markdown' : 'text/plain',
    }));
}

/**
 * Get file extension
 * @param filename - File name
 * @returns File extension with dot (e.g., '.txt')
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : '';
}

/**
 * Format token count for display
 * @param tokens - Token count
 * @returns Formatted string with commas
 */
export function formatTokenCount(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * Calculate percentage of context used
 * @param currentTokens - Current token count
 * @returns Percentage as number (0-100)
 */
export function calculateContextPercentage(currentTokens: number): number {
  const percentage = (currentTokens / FILE_UPLOAD_CONSTRAINTS.MAX_TOTAL_TOKENS) * 100;
  return Math.min(100, Math.max(0, percentage));
}

