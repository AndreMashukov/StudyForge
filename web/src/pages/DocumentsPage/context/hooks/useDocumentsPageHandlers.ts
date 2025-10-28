import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedDocument, setSearchQuery, setSelectedDirectory, selectSelectedDirectoryId } from '../../../../store/slices/directorySlice';
import { useDeleteDocument } from './api/useDeleteDocument';
import type { RootState } from '../../../../store';

export const useDocumentsPageHandlers = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { deleteDocument } = useDeleteDocument();
  
  // Get current directory ID from Redux
  const currentDirectoryId = useSelector((state: RootState) => selectSelectedDirectoryId(state));

  const handleCreateDocument = useCallback(() => {
    // Pass directoryId as query parameter if one is selected
    if (currentDirectoryId) {
      navigate(`/documents/create?directoryId=${currentDirectoryId}`);
    } else {
      navigate('/documents/create');
    }
  }, [navigate, currentDirectoryId]);

  const handleViewDocument = useCallback((documentId: string) => {
    dispatch(setSelectedDocument(documentId));
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

  const handleSelectDirectory = useCallback((directoryId: string | null) => {
    dispatch(setSelectedDirectory(directoryId));
  }, [dispatch]);

  return {
    handleCreateDocument,
    handleViewDocument,
    handleDeleteDocument,
    handleCreateQuizFromDocument,
    handleSearchChange,
    handleSelectDirectory,
  };
};