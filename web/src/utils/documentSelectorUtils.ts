/**
 * Document Selector Utility Functions
 * Utilities for selecting and processing library documents as context
 */

import { DocumentEnhanced } from '@shared-types';
import { IAttachedFile, FILE_UPLOAD_CONSTRAINTS } from '../types/fileUpload';
import { calculateTokenCount } from './fileUploadUtils';

/**
 * Fetches document content from the backend
 * Note: This should be called via RTK Query hook (useLazyGetDocumentContentQuery)
 * This function is a helper for type checking and processing
 */
export async function fetchDocumentContent(
  fetchContentFn: (documentId: string) => Promise<{ data?: { content: string }; error?: { message?: string } }>,
  documentId: string
): Promise<string> {
  try {
    const result = await fetchContentFn(documentId);
    
    if (result.error) {
      throw new Error(result.error.message || 'Failed to fetch document content');
    }
    
    if (!result.data || !result.data.content) {
      throw new Error('No content returned from server');
    }
    
    return result.data.content;
  } catch (error) {
    console.error('Error fetching document content:', error);
    throw error;
  }
}

/**
 * Converts a DocumentEnhanced and its content to an IAttachedFile
 */
export function convertDocumentToAttachedFile(
  document: DocumentEnhanced,
  content: string
): Omit<IAttachedFile, 'id'> {
  const characterCount = content.length;
  const estimatedTokens = calculateTokenCount(content);
  
  return {
    filename: `${document.title}.md`,
    size: characterCount,
    content,
    characterCount,
    estimatedTokens,
    status: 'ready',
    source: 'library',
    documentId: document.id,
  };
}

/**
 * Validates if a document can be added based on size constraints
 */
export function validateDocumentSize(
  document: DocumentEnhanced,
  currentTotalTokens: number
): {
  isValid: boolean;
  warning?: string;
  error?: string;
} {
  const estimatedDocTokens = Math.ceil(document.wordCount * 1.3); // Rough estimate: 1 word ≈ 1.3 tokens
  
  // Check if document is very large (>50K words)
  if (document.wordCount > 50000) {
    return {
      isValid: false,
      error: `Document "${document.title}" is too large (${document.wordCount.toLocaleString()} words). Please select a smaller document.`,
    };
  }
  
  // Check if adding this document would exceed token limit
  if (currentTotalTokens + estimatedDocTokens > FILE_UPLOAD_CONSTRAINTS.MAX_TOTAL_TOKENS) {
    return {
      isValid: false,
      error: `Adding "${document.title}" would exceed the ${FILE_UPLOAD_CONSTRAINTS.MAX_TOTAL_TOKENS.toLocaleString()} token limit. Please remove some files first.`,
    };
  }
  
  // Warn if document is moderately large (>25K words)
  if (document.wordCount > 25000) {
    return {
      isValid: true,
      warning: `Document "${document.title}" is large (${document.wordCount.toLocaleString()} words). Monitor your context size.`,
    };
  }
  
  return { isValid: true };
}

/**
 * Checks if a document is already attached
 */
export function isDocumentAlreadyAttached(
  documentId: string,
  attachedFiles: IAttachedFile[]
): boolean {
  return attachedFiles.some(
    file => file.source === 'library' && file.documentId === documentId
  );
}

/**
 * Gets the total token count from all attached files
 */
export function getTotalTokenCount(attachedFiles: IAttachedFile[]): number {
  return attachedFiles.reduce((sum, file) => sum + file.estimatedTokens, 0);
}

/**
 * Gets counts by source type
 */
export function getSourceCounts(attachedFiles: IAttachedFile[]): {
  upload: number;
  library: number;
  total: number;
} {
  const upload = attachedFiles.filter(f => f.source === 'upload').length;
  const library = attachedFiles.filter(f => f.source === 'library').length;
  
  return {
    upload,
    library,
    total: upload + library,
  };
}

/**
 * Checks if more items can be attached (combined limit of 5)
 */
export function canAttachMore(attachedFiles: IAttachedFile[]): boolean {
  return attachedFiles.length < FILE_UPLOAD_CONSTRAINTS.MAX_FILES;
}

/**
 * Generates a user-friendly error message for document selection
 */
export function getDocumentSelectionError(
  reason: 'max_files' | 'already_attached' | 'too_large' | 'token_limit',
  documentTitle?: string
): string {
  switch (reason) {
    case 'max_files':
      return `You can attach a maximum of ${FILE_UPLOAD_CONSTRAINTS.MAX_FILES} files/documents. Please remove some items first.`;
    case 'already_attached':
      return `"${documentTitle}" is already attached.`;
    case 'too_large':
      return `"${documentTitle}" is too large to attach.`;
    case 'token_limit':
      return `Adding "${documentTitle}" would exceed the token limit. Please remove some items first.`;
    default:
      return 'Unable to attach document.';
  }
}

