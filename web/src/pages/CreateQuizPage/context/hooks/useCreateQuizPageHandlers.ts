import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { useGenerateQuizMutation } from '../../../../store/api/Quiz/QuizApi';
import { ICreateQuizFormData } from '../../types/ICreateQuizPageTypes';
import { showToast } from '../../../../store/slices/uiSlice';

interface UseCreateQuizPageHandlersProps {
  form: UseFormReturn<ICreateQuizFormData>;
}

export const useCreateQuizPageHandlers = ({ form }: UseCreateQuizPageHandlersProps) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [generateQuiz, { isLoading: isSubmitting }] = useGenerateQuizMutation();

  const handleSubmit = useCallback(async (formData: ICreateQuizFormData) => {
    if (!formData.documentId) {
      return;
    }

    try {
      console.log('Generating quiz with data:', formData);
      
      // Use enhanced API structure with quiz name, additional prompt, and rules
      const result = await generateQuiz({ 
        documentId: formData.documentId,
        quizName: formData.quizName?.trim() || undefined,
        additionalPrompt: formData.additionalPrompt?.trim() || undefined,
        quizRuleIds: formData.quizRuleIds || [],
        followupRuleIds: formData.followupRuleIds || []
      }).unwrap();
      
      if (result.success && result.data) {
        console.log('Quiz generated successfully:', result.data.quizId);
        
        // Show success message
        dispatch(showToast({
          message: 'Quiz generated successfully!',
          type: 'success'
        }));
        
        // Navigate to My Quizzes page as per requirements
        navigate('/quizzes', { 
          state: { 
            newQuizId: result.data.quizId,
            message: 'Quiz generated successfully!' 
          }
        });
      } else {
        console.error('Failed to generate quiz:', result.error);
        dispatch(showToast({
          message: result.error?.message || 'Failed to generate quiz',
          type: 'error'
        }));
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      dispatch(showToast({
        message: error instanceof Error ? error.message : 'Failed to generate quiz',
        type: 'error'
      }));
    }
  }, [generateQuiz, navigate, dispatch]);

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting,
  };
};