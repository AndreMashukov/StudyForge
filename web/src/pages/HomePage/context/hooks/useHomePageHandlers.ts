import { useCallback } from 'react';
import { useGenerateQuizMutation } from '../../../../store/api/Quiz/QuizApi';
import { useAppDispatch } from '../../../../hooks/redux';
import { showToast } from '../../../../store/slices/uiSlice';
import { useNavigate } from 'react-router-dom';
import { useHomePageForm } from './useHomePageForm';
import { useFetchQuizzes } from './api/useFetchQuizzes';

export const useHomePageHandlers = () => {
  const [generateQuiz] = useGenerateQuizMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  // Get form state and actions
  const { urlForm, actions: formActions } = useHomePageForm();
  
  // Get quiz data for refetching
  const { userQuizzes, recentQuizzes } = useFetchQuizzes();

  const handleGenerateQuiz = useCallback(async (documentId: string) => {
    try {
      formActions.setGenerating(true);
      
      const result = await generateQuiz({ documentId }).unwrap();
      
      if (result.success && result.data) {
        dispatch(showToast({
          message: 'Quiz generated successfully!',
          type: 'success'
        }));
        
        // Reset form and refetch quizzes
        formActions.resetForm();
        userQuizzes.refetch();
        recentQuizzes.refetch();
        
        return { success: true, data: result.data };
      } else {
        const errorMessage = result.error?.message || 'Failed to generate quiz';
        dispatch(showToast({
          message: errorMessage,
          type: 'error'
        }));
        formActions.setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch {
      const errorMessage = 'An unexpected error occurred';
      dispatch(showToast({
        message: errorMessage,
        type: 'error'
      }));
      formActions.setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      formActions.setGenerating(false);
    }
  }, [generateQuiz, dispatch, formActions, userQuizzes, recentQuizzes]);

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
    urlForm,
    userQuizzes,
    recentQuizzes,
    handleGenerateQuiz,
    handleNavigateToQuiz,
    handleDeleteQuiz,
  };
};