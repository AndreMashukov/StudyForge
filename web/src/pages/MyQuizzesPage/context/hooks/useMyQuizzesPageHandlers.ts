import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeleteQuizMutation } from '../../../../store/api/Quiz/QuizApi';

export const useMyQuizzesPageHandlers = () => {
  const navigate = useNavigate();
  const [deleteQuizMutation] = useDeleteQuizMutation();

  const handleQuizClick = useCallback((quizId: string) => {
    navigate(`/quiz/${quizId}`);
  }, [navigate]);

  const handleDeleteQuiz = useCallback(async (quizId: string) => {
    if (window.confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
      try {
        const result = await deleteQuizMutation({ quizId }).unwrap();
        if (result.success) {
          // Success - the API cache will automatically update
          return { success: true };
        }
        return { success: false, error: 'Delete failed' };
      } catch (error) {
        console.error('Failed to delete quiz:', error);
        alert('Failed to delete quiz. Please try again.');
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
    return { success: false, error: 'Cancelled' };
  }, [deleteQuizMutation]);

  return {
    handleQuizClick,
    handleDeleteQuiz,
  };
};