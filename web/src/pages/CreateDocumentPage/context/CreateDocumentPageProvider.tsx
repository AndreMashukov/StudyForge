import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateDocumentPageContext } from './CreateDocumentPageContext';
import { ICreateDocumentPageContext } from '../types/ICreateDocumentPageContext';
import { IUrlScrapingFormData } from '../components/UrlScrapingForm/IUrlScrapingForm';
import { IFileUploadFormData } from '../components/FileUploadForm/IFileUploadForm';
import { useCreateDocumentFromUrlMutation, useCreateDocumentMutation } from '../../../store/api/Documents';
import { DocumentSourceType } from '@shared-types';

interface CreateDocumentPageProviderProps {
  children: React.ReactNode;
}

export const CreateDocumentPageProvider: React.FC<CreateDocumentPageProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  
  const [createDocumentFromUrl, { isLoading: isLoadingUrl }] = useCreateDocumentFromUrlMutation();
  const [createDocument, { isLoading: isLoadingFile }] = useCreateDocumentMutation();
  
  const isLoading = isLoadingUrl || isLoadingFile;

  const handlers = useMemo(() => ({
    handleGoBack: () => {
      navigate('/documents');
    },
    
    handleCreateFromUrl: async (data: IUrlScrapingFormData) => {
      try {
        setError(null);
        const result = await createDocumentFromUrl({
          url: data.url,
          title: data.title,
        }).unwrap();
        
        // Navigate to the created document or documents library
        navigate(`/document/${result.id}`);
      } catch (err) {
        console.error('Error creating document from URL:', err);
        setError('Failed to create document from URL. Please check the URL and try again.');
      }
    },
    
    handleCreateFromFile: async (data: IFileUploadFormData) => {
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
    },
  }), [navigate, createDocumentFromUrl, createDocument]);

  const contextValue: ICreateDocumentPageContext = {
    isLoading,
    error,
    handlers,
  };

  return (
    <CreateDocumentPageContext.Provider value={contextValue}>
      {children}
    </CreateDocumentPageContext.Provider>
  );
};