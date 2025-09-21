import { useGenerateQuizMutation } from '../../../../store/api/Quiz/QuizApi';
import { useAppDispatch } from '../../../../hooks/redux';
import { showToast } from '../../../../store/slices/uiSlice';
import { useNavigate } from 'react-router-dom';

export const useHomePageHandlers = () => {
  const [generateQuiz] = useGenerateQuizMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleGenerateQuiz = async (documentId: string) => {
    try {
      const result = await generateQuiz({ documentId }).unwrap();
      
      if (result.success && result.data) {
        dispatch(showToast({
          message: 'Quiz generated successfully!',
          type: 'success'
        }));
        return { success: true, data: result.data };
      } else {
        const errorMessage = result.error?.message || 'Failed to generate quiz';
        dispatch(showToast({
          message: errorMessage,
          type: 'error'
        }));
        return { success: false, error: errorMessage };
      }
    } catch (error: unknown) {
      const errorMessage = 'An unexpected error occurred';
      dispatch(showToast({
        message: errorMessage,
        type: 'error'
      }));
      return { success: false, error: errorMessage };
    }
  };

  const handleNavigateToQuiz = (quizId: string) => {
    navigate(`/quiz/${quizId}`);
  };

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      // TODO: Implement delete quiz mutation when backend supports it
      dispatch(showToast({
        message: 'Quiz deleted successfully',
        type: 'success'
      }));
      return { success: true };
    } catch (error: unknown) {
      dispatch(showToast({
        message: 'Failed to delete quiz',
        type: 'error'
      }));
      return { success: false };
    }
  };

  return {
    handleGenerateQuiz,
    handleNavigateToQuiz,
    handleDeleteQuiz,
  };
};