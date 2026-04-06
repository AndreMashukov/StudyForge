import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  useCreateDocumentFromUrlMutation, 
  useCreateDocumentMutation,
  useGenerateFromPromptMutation 
} from '../../../../store/api/Documents';
import { IUrlScrapingFormData } from '../../CreateDocumentPageContainer/UrlScrapingForm/IUrlScrapingForm';
import { IFileUploadFormData } from '../../CreateDocumentPageContainer/FileUploadForm/IFileUploadForm';
import { ITextPromptFormData } from '../../CreateDocumentPageContainer/TextPromptForm/ITextPromptForm';
import { DocumentSourceType, IFileContent } from '@shared-types';
import { 
  setError, 
  clearError, 
  setUrlFormLoading, 
  setFileFormLoading,
  setTextPromptFormLoading,
  setTextPromptFormProgress,
  selectCreateDocumentPageError,
  selectUrlFormLoading,
  selectFileFormLoading,
  selectTextPromptFormLoading,
  selectTextPromptFormProgress,
  clearFiles,
} from '../../../../store/slices/createDocumentPageSlice';
import { selectSelectedDirectoryId } from '../../../../store/slices/directorySlice';
import type { RootState } from '../../../../store';

export const useCreateDocumentPageHandlers = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // Redux selectors
  const error = useSelector((state: RootState) => selectCreateDocumentPageError(state));
  const isUrlLoading = useSelector((state: RootState) => selectUrlFormLoading(state));
  const isFileLoading = useSelector((state: RootState) => selectFileFormLoading(state));
  const isTextPromptLoading = useSelector((state: RootState) => selectTextPromptFormLoading(state));
  const textPromptProgress = useSelector((state: RootState) => selectTextPromptFormProgress(state));
  const directoryId = useSelector((state: RootState) => selectSelectedDirectoryId(state)); // 🆕 Get directoryId from global directory selection
  
  const [createDocumentFromUrl] = useCreateDocumentFromUrlMutation();
  const [createDocument] = useCreateDocumentMutation();
  const [generateFromPrompt] = useGenerateFromPromptMutation();
  
  const isLoading = isUrlLoading || isFileLoading || isTextPromptLoading;

  const handleGoBack = useCallback(() => {
    navigate('/documents');
  }, [navigate]);

  const handleCreateFromUrl = useCallback((data: IUrlScrapingFormData) => {
    dispatch(clearError());
    if (!directoryId) {
      dispatch(setError('Select a folder first (open My Directories and choose a folder).'));
      return;
    }
    createDocumentFromUrl({
      url: data.url,
      title: data.title,
      directoryId,
      ruleIds: data.ruleIds,
    });
    navigate(`/directory/${encodeURIComponent(directoryId)}?tab=sources`);
  }, [createDocumentFromUrl, navigate, dispatch, directoryId]);

  const handleCreateFromFile = useCallback(async (data: IFileUploadFormData) => {
    dispatch(clearError());
    if (!directoryId) {
      dispatch(setError('Select a folder first (open My Directories and choose a folder).'));
      return;
    }

    // Read file content (must await since FileReader is async)
    const fileContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(data.file);
    });

    createDocument({
      title: data.title || data.file.name.replace(/\.md$/, ''),
      content: fileContent,
      sourceType: DocumentSourceType.UPLOAD,
      directoryId,
      ruleIds: data.ruleIds,
    });
    navigate(`/directory/${encodeURIComponent(directoryId)}?tab=sources`);
  }, [createDocument, navigate, dispatch, directoryId]);

  const handleCreateFromTextPrompt = useCallback((
    data: ITextPromptFormData,
    fileUploadHelpers: {
      isContextSizeValid: () => boolean;
      getFilesForSubmission: () => IFileContent[];
    }
  ) => {
    dispatch(clearError());

    if (!fileUploadHelpers.isContextSizeValid()) {
      dispatch(setError('Total context size exceeds limit. Please remove some files.'));
      return;
    }

    if (!directoryId) {
      dispatch(setError('Select a folder first (open My Directories and choose a folder).'));
      return;
    }

    const files = fileUploadHelpers.getFilesForSubmission();

    generateFromPrompt({
      prompt: data.prompt,
      files: files.length > 0 ? files : undefined,
      directoryId,
      ruleIds: data.ruleIds || [],
    });

    dispatch(clearFiles());
    navigate(`/directory/${encodeURIComponent(directoryId)}?tab=sources`);
  }, [generateFromPrompt, navigate, dispatch, directoryId]);

  return {
    handleGoBack,
    handleCreateFromUrl,
    handleCreateFromFile,
    handleCreateFromTextPrompt,
    isLoading,
    isTextPromptLoading,
    textPromptProgress,
    error,
  };
};