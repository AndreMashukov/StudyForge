import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateDocumentFromUrlMutation, useCreateDocumentMutation } from '../../../../store/api/Documents';
import { IUrlScrapingFormData } from '../../components/UrlScrapingForm/IUrlScrapingForm';
import { IFileUploadFormData } from '../../components/FileUploadForm/IFileUploadForm';
import { DocumentSourceType } from '@shared-types';

export const useCreateDocumentPageHandlers = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  
  const [createDocumentFromUrl, { isLoading: isLoadingUrl }] = useCreateDocumentFromUrlMutation();
  const [createDocument, { isLoading: isLoadingFile }] = useCreateDocumentMutation();
  
  const isLoading = isLoadingUrl || isLoadingFile;

  const handleGoBack = useCallback(() => {
    navigate('/documents');
  }, [navigate]);

  const handleCreateFromUrl = useCallback(async (data: IUrlScrapingFormData) => {
    try {
      setError(null);
      const result = await createDocumentFromUrl({
        url: data.url,
        title: data.title,
      }).unwrap();
      
      // Phase 2.2: Redirect to documents page with generation option
      navigate(`/documents?highlight=${result.id}&action=generate-quiz`);
    } catch (err) {
      console.error('Error creating document from URL:', err);
      setError('Failed to create document from URL. Please check the URL and try again.');
    }
  }, [createDocumentFromUrl, navigate]);

  const handleCreateFromFile = useCallback(async (data: IFileUploadFormData) => {
    try {
      setError(null);
      
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
      setError('Failed to create document from file. Please try again.');
    }
  }, [createDocument, navigate]);

  return {
    handleGoBack,
    handleCreateFromUrl,
    handleCreateFromFile,
    isLoading,
    error,
  };
};