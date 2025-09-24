import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { DocumentsPageContext } from './DocumentsPageContext';
import { IDocumentsPageContext } from '../types/IDocumentsPageContext';
import { useFetchDocuments } from './hooks/api/useFetchDocuments';
import { useDocumentsPageHandlers } from './hooks/useDocumentsPageHandlers';
import { selectSearchQuery } from '../../../store/slices/documentsPageSlice';

interface DocumentsPageProviderProps {
  children: React.ReactNode;
}

export const DocumentsPageProvider: React.FC<DocumentsPageProviderProps> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = useSelector(selectSearchQuery);

  const { documents, isLoading, error: fetchError } = useFetchDocuments(
    searchQuery.trim() || undefined
  );
  
  const handlers = useDocumentsPageHandlers();

  // Handle URL parameters for auto-quiz generation
  useEffect(() => {
    const highlightDocId = searchParams.get('highlight');
    const action = searchParams.get('action');
    
    if (highlightDocId && action === 'generate-quiz' && documents && documents.length > 0) {
      const documentExists = documents.find(doc => doc.id === highlightDocId);
      if (documentExists) {
        // Auto-trigger quiz generation for the highlighted document
        console.log('Auto-triggering quiz generation for document:', highlightDocId);
        handlers.handleCreateQuizFromDocument(highlightDocId);
        
        // Clear the URL parameters after processing
        setSearchParams({}); 
      }
    }
  }, [documents, searchParams, setSearchParams, handlers]);

  const contextValue: IDocumentsPageContext = {
    documents: documents || [],
    searchQuery,
    isLoading,
    error: fetchError ? 'Failed to load documents' : null,
    handlers,
  };

  return (
    <DocumentsPageContext.Provider value={contextValue}>
      {children}
    </DocumentsPageContext.Provider>
  );
};