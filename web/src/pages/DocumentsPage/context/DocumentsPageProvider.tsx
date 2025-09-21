import React, { useState, useMemo } from 'react';
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

  const { documents, isLoading, error: fetchError } = useFetchDocuments(
    localSearchQuery.trim() || undefined
  );
  
  const { deleteDocument } = useDeleteDocument();
  const baseHandlers = useDocumentsPageHandlers();

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