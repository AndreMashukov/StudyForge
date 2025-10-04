/**
 * File Upload Hook
 * Handles file attachment operations for Text Prompt feature
 */

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../../store';
import {
  addFile,
  removeFile,
  updateFileStatus,
  clearFiles,
  setContextSizeError,
  selectAttachedFiles,
  selectTotalContextSize,
  selectContextSizeError,
  selectCanAttachMore,
  selectAttachedFilesCount,
} from '../../../../store/slices/createDocumentPageSlice';
import {
  validateFile,
  validateTotalContextSize,
  processFile,
  generateFileId,
  convertToFileContent,
} from '../../../../utils/fileUploadUtils';
import {
  FILE_UPLOAD_CONSTRAINTS,
  FILE_UPLOAD_ERRORS,
  IAttachedFile,
} from '../../../../types/fileUpload';

/**
 * Hook for managing file attachments in the Text Prompt form
 */
export const useFileUpload = () => {
  const dispatch = useDispatch();

  // Selectors
  const attachedFiles = useSelector((state: RootState) => selectAttachedFiles(state));
  const totalContextSize = useSelector((state: RootState) => selectTotalContextSize(state));
  const contextSizeError = useSelector((state: RootState) => selectContextSizeError(state));
  const canAttachMore = useSelector((state: RootState) => selectCanAttachMore(state));
  const attachedFilesCount = useSelector((state: RootState) => selectAttachedFilesCount(state));

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

  return {
    // State
    attachedFiles,
    totalContextSize,
    contextSizeError,
    canAttachMore,
    attachedFilesCount,

    // Actions
    handleFileAdd,
    handleFileRemove,
    handleClearAll,

    // Utilities
    getTotalTokens,
    getFilesForSubmission,
    isContextSizeValid,
    getReadyFilesCount,
  };
};

