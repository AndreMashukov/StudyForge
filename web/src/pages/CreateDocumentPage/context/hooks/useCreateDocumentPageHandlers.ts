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
import { DocumentSourceType } from '@shared-types';
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
  selectTextPromptFormProgress 
} from '../../../../store/slices/createDocumentPageSlice';
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
  
  const [createDocumentFromUrl] = useCreateDocumentFromUrlMutation();
  const [createDocument] = useCreateDocumentMutation();
  const [generateFromPrompt] = useGenerateFromPromptMutation();
  
  const isLoading = isUrlLoading || isFileLoading || isTextPromptLoading;

  const handleGoBack = useCallback(() => {
    navigate('/documents');
  }, [navigate]);

  const handleCreateFromUrl = useCallback(async (data: IUrlScrapingFormData) => {
    try {
      dispatch(clearError());
      dispatch(setUrlFormLoading(true));
      
      const result = await createDocumentFromUrl({
        url: data.url,
        title: data.title,
      }).unwrap();
      
      // Phase 2.2: Redirect to documents page with generation option
      navigate(`/documents?highlight=${result.id}&action=generate-quiz`);
    } catch (err) {
      console.error('Error creating document from URL:', err);
      dispatch(setError('Failed to create document from URL. Please check the URL and try again.'));
    } finally {
      dispatch(setUrlFormLoading(false));
    }
  }, [createDocumentFromUrl, navigate, dispatch]);

  const handleCreateFromFile = useCallback(async (data: IFileUploadFormData) => {
    try {
      dispatch(clearError());
      dispatch(setFileFormLoading(true));
      
      // Read file content
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(data.file);
      });

      const result = await createDocument({
        title: data.title || data.file.name.replace(/\.md$/, ''),
        content,
        sourceType: DocumentSourceType.UPLOAD,
      }).unwrap();
      
      // Navigate to the created document
      navigate(`/document/${result.id}`);
    } catch (err) {
      console.error('Error creating document from file:', err);
      dispatch(setError('Failed to create document from file. Please try again.'));
    } finally {
      dispatch(setFileFormLoading(false));
    }
  }, [createDocument, navigate, dispatch]);

  const handleCreateFromTextPrompt = useCallback(async (data: ITextPromptFormData) => {
    let progressInterval: NodeJS.Timeout | undefined;
    let currentProgress = 0;
    
    try {
      dispatch(clearError());
      dispatch(setTextPromptFormLoading(true));
      dispatch(setTextPromptFormProgress(0));
      
      // Simulate progress updates
      progressInterval = setInterval(() => {
        currentProgress = Math.min(currentProgress + 10, 90);
        dispatch(setTextPromptFormProgress(currentProgress));
      }, 2000);
      
      const result = await generateFromPrompt({
        prompt: data.prompt,
      }).unwrap();
      
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      dispatch(setTextPromptFormProgress(100));
      
      // Navigate to the created document
      navigate(`/document/${result.documentId}`);
    } catch (err: any) {
      console.error('Error generating document from prompt:', err);
      const errorMessage = err?.data?.message || 'Failed to generate document. Please try again.';
      dispatch(setError(errorMessage));
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      dispatch(setTextPromptFormLoading(false));
      dispatch(setTextPromptFormProgress(0));
    }
  }, [generateFromPrompt, navigate, dispatch]);

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