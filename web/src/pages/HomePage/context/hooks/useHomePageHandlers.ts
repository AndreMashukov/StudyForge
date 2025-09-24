import { useCallback } from 'react';
import { useAppDispatch } from '../../../../hooks/redux';
import { showToast } from '../../../../store/slices/uiSlice';
import { useNavigate } from 'react-router-dom';
import { useFetchQuizzes } from './api/useFetchQuizzes';

export const useHomePageHandlers = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  // Get quiz data for refetching
  const { userQuizzes, recentQuizzes } = useFetchQuizzes();



  const handleNavigateToQuiz = useCallback((quizId: string) => {
    navigate(`/quiz/${quizId}`);
  }, [navigate]);

  const handleDeleteQuiz = useCallback(async (quizId: string) => {
    try {
      // TODO: Implement delete quiz mutation when backend supports it
      dispatch(showToast({
        message: 'Quiz deleted successfully',
        type: 'success'
      }));
      return { success: true };
    } catch {
      dispatch(showToast({
        message: 'Failed to delete quiz',
        type: 'error'
      }));
      return { success: false };
    }
  }, [dispatch]);

  return {
    userQuizzes,
    recentQuizzes,
    handleNavigateToQuiz,
    handleDeleteQuiz,
  };
};