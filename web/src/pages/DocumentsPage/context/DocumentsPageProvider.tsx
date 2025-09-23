import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DocumentsPageContext } from './DocumentsPageContext';
import { IDocumentsPageContext } from '../types/IDocumentsPageContext';
import { useFetchDocuments } from './hooks/api/useFetchDocuments';
import { useDeleteDocument } from './hooks/api/useDeleteDocument';
import { useDocumentsPageHandlers } from './hooks/useDocumentsPageHandlers';

interface DocumentsPageProviderProps {
  children: React.ReactNode;
}

export const DocumentsPageProvider: React.FC<DocumentsPageProviderProps> = ({ children }) => {
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const { documents, isLoading, error: fetchError } = useFetchDocuments(
    localSearchQuery.trim() || undefined
  );
  
  const { deleteDocument } = useDeleteDocument();
  const baseHandlers = useDocumentsPageHandlers();

  // Handle URL parameters for auto-quiz generation
  useEffect(() => {
    const highlightDocId = searchParams.get('highlight');
    const action = searchParams.get('action');
    
    if (highlightDocId && action === 'generate-quiz' && documents && documents.length > 0) {
      const documentExists = documents.find(doc => doc.id === highlightDocId);
      if (documentExists) {
        // Auto-trigger quiz generation for the highlighted document
        console.log('Auto-triggering quiz generation for document:', highlightDocId);
        baseHandlers.handleCreateQuizFromDocument(highlightDocId);
        
        // Clear the URL parameters after processing
        setSearchParams({}); 
      }
    }
  }, [documents, searchParams, setSearchParams, baseHandlers]);

  const handlers = useMemo(() => ({
    ...baseHandlers,
    handleDeleteDocument: async (documentId: string) => {
      // Use window.confirm with explicit declaration
      const confirmDelete = window.confirm('Are you sure you want to delete this document? This action cannot be undone.');
      if (confirmDelete) {
        await deleteDocument(documentId);
      }
    },
    handleSearchChange: (query: string) => {
      setLocalSearchQuery(query);
    },
  }), [baseHandlers, deleteDocument]);

  const contextValue: IDocumentsPageContext = {
    documents: documents || [],
    searchQuery: localSearchQuery,
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