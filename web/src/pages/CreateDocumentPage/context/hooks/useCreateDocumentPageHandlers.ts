import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  useCreateDocumentFromUrlMutation, 
  useUploadAndCreateDocumentMutation,
  useGenerateFromPromptMutation 
} from '../../../../store/api/Documents';
import { IUrlScrapingFormData } from '../../CreateDocumentPageContainer/UrlScrapingForm/IUrlScrapingForm';
import { IFileUploadFormData } from '../../CreateDocumentPageContainer/FileUploadForm/IFileUploadForm';
import { ITextPromptFormData } from '../../CreateDocumentPageContainer/TextPromptForm/ITextPromptForm';
import { IFileContent } from '@shared-types';
import {
  readFileAsBase64,
  stripDocumentUploadExtension,
} from '../../../../utils/documentUploadUtils';
import { 
  setError, 
  clearError, 
  selectCreateDocumentPageError,
  clearFiles,
} from '../../../../store/slices/createDocumentPageSlice';
import { selectSelectedDirectoryId } from '../../../../store/slices/directorySlice';
import type { RootState } from '../../../../store';

export const useCreateDocumentPageHandlers = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // Redux selectors
  const error = useSelector((state: RootState) => selectCreateDocumentPageError(state));
  const directoryId = useSelector((state: RootState) => selectSelectedDirectoryId(state)); // 🆕 Get directoryId from global directory selection
  
  const [createDocumentFromUrl] = useCreateDocumentFromUrlMutation();
  const [uploadAndCreateDocument] = useUploadAndCreateDocumentMutation();
  const [generateFromPrompt] = useGenerateFromPromptMutation();

  const handleGoBack = useCallback(() => {
    if (directoryId) {
      navigate(`/directory/${encodeURIComponent(directoryId)}`);
    } else {
      navigate('/documents');
    }
  }, [navigate, directoryId]);

  const handleCreateFromUrl = useCallback((data: IUrlScrapingFormData) => {
    dispatch(clearError());
    if (!directoryId) {
      dispatch(setError('Select a folder first (open My Directories and choose a folder).'));
      return;
    }
    createDocumentFromUrl({
      urls: data.urls,
      title: data.title,
      directoryId,
      ruleIds: data.ruleIds || [],
      ruleResolutionMode: 'explicit-only',
    });
    navigate(`/directory/${encodeURIComponent(directoryId)}?tab=sources`);
  }, [createDocumentFromUrl, navigate, dispatch, directoryId]);

  const handleCreateFromFile = useCallback(async (data: IFileUploadFormData) => {
    dispatch(clearError());
    if (!directoryId) {
      dispatch(setError('Select a folder first (open My Directories and choose a folder).'));
      return;
    }

    try {
      const content = await readFileAsBase64(data.file);
      const uploadPromise = uploadAndCreateDocument({
        fileName: data.file.name,
        content,
        mimeType: data.file.type || undefined,
        size: data.file.size,
        title: data.title || stripDocumentUploadExtension(data.file.name),
        directoryId,
        ruleIds: data.ruleIds,
        ruleResolutionMode: 'explicit-only',
      }).unwrap();

      navigate(`/directory/${encodeURIComponent(directoryId)}?tab=sources`);

      void uploadPromise.catch((error) => {
        dispatch(setError(getSubmissionErrorMessage(error)));
      });
    } catch (error) {
      dispatch(setError(getSubmissionErrorMessage(error)));
    }
  }, [uploadAndCreateDocument, navigate, dispatch, directoryId]);

  const handleCreateFromTextPrompt = useCallback((
    data: ITextPromptFormData,
    fileUploadHelpers?: {
      isContextSizeValid: () => boolean;
      getFilesForSubmission: () => IFileContent[];
    }
  ) => {
    dispatch(clearError());

    if (fileUploadHelpers && !fileUploadHelpers.isContextSizeValid()) {
      dispatch(setError('Total context size exceeds limit. Please remove some files.'));
      return;
    }

    if (!directoryId) {
      dispatch(setError('Select a folder first (open My Directories and choose a folder).'));
      return;
    }

    const files = fileUploadHelpers?.getFilesForSubmission() ?? [];

    generateFromPrompt({
      prompt: data.prompt,
      files: files.length > 0 ? files : undefined,
      directoryId,
      ruleIds: data.ruleIds || [],
      ruleResolutionMode: 'explicit-only',
    });

    if (fileUploadHelpers) {
      dispatch(clearFiles());
    }
    navigate(`/directory/${encodeURIComponent(directoryId)}?tab=sources`);
  }, [generateFromPrompt, navigate, dispatch, directoryId]);

  return {
    handleGoBack,
    handleCreateFromUrl,
    handleCreateFromFile,
    handleCreateFromTextPrompt,
    error,
  };
};

function getSubmissionErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const maybeError = error as { data?: { message?: unknown }; message?: unknown };
    if (typeof maybeError.data?.message === 'string') {
      return maybeError.data.message;
    }
    if (typeof maybeError.message === 'string') {
      return maybeError.message;
    }
  }

  return 'Failed to upload file. Please try again.';
}
