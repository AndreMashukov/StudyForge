import React from 'react';
import { DocumentsPageContext } from './DocumentsPageContext';
import { IDocumentsPageContext } from '../types/IDocumentsPageContext';
import { useFetchDocuments } from './hooks/api/useFetchDocuments';
import { useDocumentsPageHandlers } from './hooks/useDocumentsPageHandlers';
import { useDocumentsPageEffects } from './hooks/useDocumentsPageEffects';

interface DocumentsPageProviderProps {
  children: React.ReactNode;
}

export const DocumentsPageProvider: React.FC<DocumentsPageProviderProps> = ({ children }) => {
  const documentsApi = useFetchDocuments();
  
  const handlers = useDocumentsPageHandlers();

  // Use effect hooks for non-fetch related side effects
  useDocumentsPageEffects({
    documents: documentsApi.documents,
    handlers,
  });

  const contextValue: IDocumentsPageContext = {
    documentsApi,
    handlers,
  };

  return (
    <DocumentsPageContext.Provider value={contextValue}>
      {children}
    </DocumentsPageContext.Provider>
  );
};