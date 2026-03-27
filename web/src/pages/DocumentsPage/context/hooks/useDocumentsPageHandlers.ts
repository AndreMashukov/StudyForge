import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedDocument, setSelectedDirectory, selectSelectedDirectoryId } from '../../../../store/slices/directorySlice';
import { useDeleteDocument } from './api/useDeleteDocument';
import type { RootState } from '../../../../store';

export const useDocumentsPageHandlers = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { deleteDocument } = useDeleteDocument();
  const [, setSearchParams] = useSearchParams();
  
  // Get current directory ID from Redux
  const currentDirectoryId = useSelector((state: RootState) => selectSelectedDirectoryId(state));

  const handleCreateDocument = useCallback(() => {
    if (!currentDirectoryId) {
      window.alert('Select or create a folder first, then add documents inside it.');
      return;
    }
    navigate(`/documents/create?directoryId=${currentDirectoryId}`);
  }, [navigate, currentDirectoryId]);

  const handleViewDocument = useCallback((documentId: string) => {
    dispatch(setSelectedDocument(documentId));
    navigate(`/document/${documentId}`);
  }, [navigate, dispatch]);

  const handleCreateQuizFromDocument = useCallback((documentId: string, directoryId?: string) => {
    console.log('Navigating to create quiz page for document:', documentId);
    // Navigate to create quiz page with pre-selected document
    const params = new URLSearchParams({ documentId });
    if (directoryId) {
      params.set('directoryId', directoryId);
    }
    navigate(`/quiz/create?${params.toString()}`);
  }, [navigate]);

  const handleGenerateFlashcardsFromDocument = useCallback((documentId: string, directoryId?: string) => {
    const params = new URLSearchParams({ documentId });
    if (directoryId) {
      params.set('directoryId', directoryId);
    }
    navigate(`/flashcards/create?${params.toString()}`);
  }, [navigate]);

  const handleGenerateSlideDeckFromDocument = useCallback((documentId: string, directoryId?: string) => {
    const params = new URLSearchParams({ documentId });
    if (directoryId) {
      params.set('directoryId', directoryId);
    }
    navigate(`/slides/create?${params.toString()}`);
  }, [navigate]);

  const handleDeleteDocument = useCallback(async (documentId: string) => {
    // Use window.confirm with explicit declaration
    const confirmDelete = window.confirm('Are you sure you want to delete this document? This action cannot be undone.');
    if (confirmDelete) {
      await deleteDocument(documentId);
    }
  }, [deleteDocument]);

  const handleSelectDirectory = useCallback((directoryId: string | null) => {
    dispatch(setSelectedDirectory(directoryId));
    if (directoryId) {
      navigate(`/directory/${directoryId}`);
    } else {
      navigate('/documents');
      setSearchParams({});
    }
  }, [dispatch, navigate, setSearchParams]);

  return {
    handleCreateDocument,
    handleViewDocument,
    handleDeleteDocument,
    handleCreateQuizFromDocument,
    handleGenerateFlashcardsFromDocument,
    handleGenerateSlideDeckFromDocument,
    handleSelectDirectory,
  };
};