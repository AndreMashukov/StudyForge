import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setSelectedDocumentId } from '../../../../store/slices/documentsPageSlice';
import { useGenerateQuizMutation } from '../../../../store/api/Quiz/QuizApi';

export const useDocumentsPageHandlers = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [generateQuiz, { isLoading: isGeneratingQuiz }] = useGenerateQuizMutation();

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
    // This will be handled by the component using useDeleteDocument hook
    console.log('Delete document:', documentId);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    // This will be handled by the search state management
    console.log('Search query:', query);
  }, []);

  return {
    handleCreateDocument,
    handleViewDocument,
    handleDeleteDocument,
    handleCreateQuizFromDocument,
    handleSearchChange,
    isGeneratingQuiz,
  };
};