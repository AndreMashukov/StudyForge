import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setSelectedDocumentId, setSearchQuery } from '../../../../store/slices/documentsPageSlice';
import { useGenerateQuizMutation } from '../../../../store/api/Quiz/QuizApi';
import { useDeleteDocument } from './api/useDeleteDocument';

export const useDocumentsPageHandlers = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [generateQuiz, { isLoading: isGeneratingQuiz }] = useGenerateQuizMutation();
  const { deleteDocument } = useDeleteDocument();

  const handleCreateDocument = useCallback(() => {
    navigate('/documents/create');
  }, [navigate]);

  const handleViewDocument = useCallback((documentId: string) => {
    dispatch(setSelectedDocumentId(documentId));
    navigate(`/document/${documentId}`);
  }, [navigate, dispatch]);

  const handleCreateQuizFromDocument = useCallback(async (documentId: string) => {
    try {
      console.log('Generating quiz for document:', documentId);
      
      // Generate quiz using the documentId
      const result = await generateQuiz({ documentId }).unwrap();
      
      if (result.success && result.data) {
        console.log('Quiz generated successfully:', result.data.quizId);
        // Navigate to the generated quiz
        navigate(`/quiz/${result.data.quizId}`);
      } else {
        console.error('Failed to generate quiz:', result.error);
        // TODO: Show error message to user (implement notification system)
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      // TODO: Show error message to user (implement notification system)
    }
  }, [generateQuiz, navigate]);

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
    isGeneratingQuiz,
  };
};