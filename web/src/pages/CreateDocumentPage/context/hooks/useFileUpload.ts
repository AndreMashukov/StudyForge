/**
 * File Upload Hook
 * Handles file attachment operations for Text Prompt feature
 * Supports both uploaded files and library document selection
 */

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../../store';
import { DocumentEnhanced } from '@shared-types';
import {
  addFile,
  removeFile,
  updateFileStatus,
  clearFiles,
  setContextSizeError,
  toggleDocumentSelection,
  selectAttachedFiles,
  selectTotalContextSize,
  selectContextSizeError,
  selectCanAttachMore,
  selectAttachedFilesCount,
  selectSelectedDocumentIds,
  selectUploadedFilesCount,
  selectLibraryDocumentsCount,
} from '../../../../store/slices/createDocumentPageSlice';
import {
  validateFile,
  validateTotalContextSize,
  processFile,
  generateFileId,
  convertToFileContent,
} from '../../../../utils/fileUploadUtils';
import {
  convertDocumentToAttachedFile,
  validateDocumentSize,
  isDocumentAlreadyAttached,
  getTotalTokenCount,
  getDocumentSelectionError,
} from '../../../../utils/documentSelectorUtils';
import {
  FILE_UPLOAD_CONSTRAINTS,
  FILE_UPLOAD_ERRORS,
  IAttachedFile,
} from '../../../../types/fileUpload';
import { useLazyGetDocumentContentQuery } from '../../../../store/api/Documents';

/**
 * Hook for managing file attachments in the Text Prompt form
 * Supports both uploaded files and library document selection
 */
export const useFileUpload = (documents: DocumentEnhanced[] = []) => {
  const dispatch = useDispatch();

  // RTK Query hook for fetching document content
  const [fetchDocumentContent, { isLoading: isFetchingContent }] = useLazyGetDocumentContentQuery();

  // Selectors
  const attachedFiles = useSelector((state: RootState) => selectAttachedFiles(state));
  const totalContextSize = useSelector((state: RootState) => selectTotalContextSize(state));
  const contextSizeError = useSelector((state: RootState) => selectContextSizeError(state));
  const canAttachMore = useSelector((state: RootState) => selectCanAttachMore(state));
  const attachedFilesCount = useSelector((state: RootState) => selectAttachedFilesCount(state));
  const selectedDocumentIds = useSelector((state: RootState) => selectSelectedDocumentIds(state));
  const uploadedFilesCount = useSelector((state: RootState) => selectUploadedFilesCount(state));
  const libraryDocumentsCount = useSelector((state: RootState) => selectLibraryDocumentsCount(state));

  /**
   * Calculate total estimated tokens across all files
   */
  const getTotalTokens = useCallback(() => {
    return attachedFiles.reduce((sum, file) => sum + file.estimatedTokens, 0);
  }, [attachedFiles]);

  /**
   * Handle adding files
   * Validates and processes each file, then adds to Redux state
   */
  const handleFileAdd = useCallback(async (fileList: FileList) => {
    const files = Array.from(fileList);

    // Check if we can attach more files
    const availableSlots = FILE_UPLOAD_CONSTRAINTS.MAX_FILES - attachedFiles.length;
    if (availableSlots <= 0) {
      dispatch(setContextSizeError(FILE_UPLOAD_ERRORS.MAX_FILES_REACHED));
      return;
    }

    // Limit files to available slots
    const filesToProcess = files.slice(0, availableSlots);

    for (const file of filesToProcess) {
      const fileId = generateFileId();

      // Validate file
      const validation = validateFile(file, attachedFiles);
      if (!validation.isValid) {
        // Add file with error status
        dispatch(addFile({
          id: fileId,
          file,
          filename: file.name,
          size: file.size,
          content: '',
          characterCount: 0,
          estimatedTokens: 0,
          status: 'error',
          error: validation.errors[0], // Show first error
        }));
        continue;
      }

      // Add file in reading state
      dispatch(addFile({
        id: fileId,
        file,
        filename: file.name,
        size: file.size,
        content: '',
        characterCount: 0,
        estimatedTokens: 0,
        status: 'reading',
      }));

      // Process file asynchronously
      try {
        const processedFile = await processFile(file);

        // Update file with processed data
        dispatch(updateFileStatus({
          id: fileId,
          status: 'ready',
        }));

        // Update the file with full data
        const updatedFile: IAttachedFile = {
          id: fileId,
          ...processedFile,
        };

        // Replace the file in state with full data
        dispatch(removeFile(fileId));
        dispatch(addFile(updatedFile));

        // Validate total context size after adding
        const currentFiles = [...attachedFiles, updatedFile].filter(f => f.status === 'ready');
        const contextValidation = validateTotalContextSize(currentFiles);
        
        if (!contextValidation.isValid) {
          dispatch(setContextSizeError(contextValidation.errors[0]));
        } else {
          dispatch(setContextSizeError(null));
        }

      } catch (error) {
        // Update file with error status
        dispatch(updateFileStatus({
          id: fileId,
          status: 'error',
          error: error instanceof Error ? error.message : FILE_UPLOAD_ERRORS.FILE_READ_ERROR,
        }));
      }
    }

    // Warn if we had to skip files
    if (files.length > availableSlots) {
      const skipped = files.length - availableSlots;
      console.warn(`Skipped ${skipped} file(s) due to max files limit`);
    }
  }, [attachedFiles, dispatch]);

  /**
   * Handle removing a file
   */
  const handleFileRemove = useCallback((fileId: string) => {
    dispatch(removeFile(fileId));

    // Revalidate context size after removal
    const remainingFiles = attachedFiles.filter(f => f.id !== fileId && f.status === 'ready');
    const contextValidation = validateTotalContextSize(remainingFiles);
    
    if (!contextValidation.isValid) {
      dispatch(setContextSizeError(contextValidation.errors[0]));
    } else {
      dispatch(setContextSizeError(null));
    }
  }, [attachedFiles, dispatch]);

  /**
   * Clear all files
   */
  const handleClearAll = useCallback(() => {
    dispatch(clearFiles());
  }, [dispatch]);

  /**
   * Get files ready for API submission
   */
  const getFilesForSubmission = useCallback(() => {
    return convertToFileContent(attachedFiles);
  }, [attachedFiles]);

  /**
   * Check if context size exceeds limit
   */
  const isContextSizeValid = useCallback(() => {
    const totalTokens = getTotalTokens();
    return totalTokens <= FILE_UPLOAD_CONSTRAINTS.MAX_TOTAL_TOKENS;
  }, [getTotalTokens]);

  /**
   * Get ready files count (exclude reading/error states)
   */
  const getReadyFilesCount = useCallback(() => {
    return attachedFiles.filter(f => f.status === 'ready').length;
  }, [attachedFiles]);

  /**
   * Handle toggling document selection from library
   * Auto-adds or removes document when checkbox is toggled
   */
  const handleDocumentToggle = useCallback(async (documentId: string) => {
    // Check if document is already attached
    const isAlreadyAttached = isDocumentAlreadyAttached(documentId, attachedFiles);

    if (isAlreadyAttached) {
      // Remove document
      const fileToRemove = attachedFiles.find(
        f => f.source === 'library' && f.documentId === documentId
      );
      if (fileToRemove) {
        dispatch(removeFile(fileToRemove.id));
        dispatch(toggleDocumentSelection(documentId));
        
        // Revalidate context size
        const remainingFiles = attachedFiles.filter(
          f => f.id !== fileToRemove.id && f.status === 'ready'
        );
        const contextValidation = validateTotalContextSize(remainingFiles);
        if (!contextValidation.isValid) {
          dispatch(setContextSizeError(contextValidation.errors[0]));
        } else {
          dispatch(setContextSizeError(null));
        }
      }
      return;
    }

    // Check if we can add more
    if (!canAttachMore) {
      dispatch(setContextSizeError(getDocumentSelectionError('max_files')));
      return;
    }

    // Find document in the list
    const document = documents.find(d => d.id === documentId);
    if (!document) {
      console.error(`Document not found: ${documentId}`);
      dispatch(setContextSizeError('Document not found'));
      return;
    }

    // Validate document size
    const currentTotalTokens = getTotalTokenCount(attachedFiles);
    const sizeValidation = validateDocumentSize(document, currentTotalTokens);
    
    if (!sizeValidation.isValid) {
      dispatch(setContextSizeError(sizeValidation.error || 'Document too large'));
      return;
    }

    // Show warning if document is large
    if (sizeValidation.warning) {
      console.warn(sizeValidation.warning);
    }

    // Generate file ID
    const fileId = generateFileId();

    // Add document with loading state
    dispatch(addFile({
      id: fileId,
      filename: `${document.title}.md`,
      size: 0,
      content: '',
      characterCount: 0,
      estimatedTokens: 0,
      status: 'reading',
      source: 'library',
      documentId: document.id,
    }));

    // Toggle selection in Redux
    dispatch(toggleDocumentSelection(documentId));
    dispatch(setContextSizeError(null));

    try {
      // Fetch document content
      const result = await fetchDocumentContent(documentId);

      if (result.error) {
        // Handle specific error types
        const errorMessage = result.error.status === 404 
          ? 'Document not found or has been deleted'
          : result.error.status === 403
          ? 'You do not have permission to access this document'
          : result.error.data?.message || 'Failed to fetch document content';
        throw new Error(errorMessage);
      }

      if (!result.data || !result.data.content) {
        throw new Error('No content returned from server');
      }

      const content = result.data.content;

      // Validate content is not empty after fetch
      if (!content || content.trim().length === 0) {
        throw new Error('Document content is empty');
      }

      // Convert to attached file format
      const attachedFile = convertDocumentToAttachedFile(document, content);

      // Update with full data
      dispatch(removeFile(fileId));
      dispatch(addFile({
        id: fileId,
        ...attachedFile,
      }));

      // Validate total context size
      const updatedFiles = [...attachedFiles.filter(f => f.id !== fileId), {
        id: fileId,
        ...attachedFile,
      }].filter(f => f.status === 'ready');
      
      const contextValidation = validateTotalContextSize(updatedFiles);
      if (!contextValidation.isValid) {
        dispatch(setContextSizeError(contextValidation.errors[0]));
        // Remove the document if it exceeds limit
        dispatch(removeFile(fileId));
        dispatch(toggleDocumentSelection(documentId));
      } else {
        dispatch(setContextSizeError(null));
      }

    } catch (error) {
      console.error('Error fetching document content:', error);
      
      // Determine user-friendly error message
      let errorMessage = 'Failed to load document';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Check for specific error patterns
      if (errorMessage.includes('network') || errorMessage.includes('Network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        errorMessage = 'Request timed out. The document may be too large.';
      }
      
      // Update with error status
      dispatch(updateFileStatus({
        id: fileId,
        status: 'error',
        error: errorMessage,
      }));

      // Remove selection on error
      dispatch(toggleDocumentSelection(documentId));
      dispatch(setContextSizeError(errorMessage));
    }
  }, [
    attachedFiles,
    canAttachMore,
    documents,
    dispatch,
    fetchDocumentContent,
  ]);

  return {
    // State
    attachedFiles,
    totalContextSize,
    contextSizeError,
    canAttachMore,
    attachedFilesCount,
    selectedDocumentIds,
    uploadedFilesCount,
    libraryDocumentsCount,
    isFetchingContent,

    // Actions
    handleFileAdd,
    handleFileRemove,
    handleClearAll,
    handleDocumentToggle,

    // Utilities
    getTotalTokens,
    getFilesForSubmission,
    isContextSizeValid,
    getReadyFilesCount,
  };
};

