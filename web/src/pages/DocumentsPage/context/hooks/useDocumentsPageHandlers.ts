import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setSelectedDocumentId, setSearchQuery } from '../../../../store/slices/documentsPageSlice';
import { useDeleteDocument } from './api/useDeleteDocument';

export const useDocumentsPageHandlers = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { deleteDocument } = useDeleteDocument();

  const handleCreateDocument = useCallback(() => {
    navigate('/documents/create');
  }, [navigate]);

  const handleViewDocument = useCallback((documentId: string) => {
    dispatch(setSelectedDocumentId(documentId));
    navigate(`/document/${documentId}`);
  }, [navigate, dispatch]);

  const handleCreateQuizFromDocument = useCallback((documentId: string) => {
    console.log('Navigating to create quiz page for document:', documentId);
    // Navigate to create quiz page with pre-selected document
    navigate(`/quiz/create?documentId=${documentId}`);
  }, [navigate]);

  const handleDeleteDocument = useCallback(async (documentId: string) => {
    // Use window.confirm with explicit declaration
    const confirmDelete = window.confirm('Are you sure you want to delete this document? This action cannot be undone.');
    if (confirmDelete) {
      await deleteDocument(documentId);
    }
  }, [deleteDocument]);

  const handleSearchChange = useCallback((query: string) => {
    dispatch(setSearchQuery(query));
  }, [dispatch]);

  return {
    handleCreateDocument,
    handleViewDocument,
    handleDeleteDocument,
    handleCreateQuizFromDocument,
    handleSearchChange,
  };
};