import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { z } from 'zod';
import {
  setSubmitting,
  setFormErrors,
  clearFormErrors,
} from '../../../../store/slices/quizPageSlice';
import {
  quizAnswerSchema,
  handleQuizValidationError,
  type QuizAnswerFormData,
} from './useQuizSchema';

export const useQuizForm = () => {
  const dispatch = useDispatch();
  const [localFormState, setLocalFormState] = useState({
    selectedAnswer: null as number | null,
  });

  const handleSubmitAnswer = useCallback(async (answerIndex: number, questionId: number) => {
    try {
      dispatch(setSubmitting(true));
      dispatch(clearFormErrors());

      // Validate the answer using Zod
      const formData: QuizAnswerFormData = {
        selectedAnswer: answerIndex,
        questionId,
      };

      const validatedData = quizAnswerSchema.parse(formData);
      
      // If validation passes, return success
      dispatch(setSubmitting(false));
      return { success: true, data: validatedData };
      
    } catch (error) {
      dispatch(setSubmitting(false));
      
      if (error instanceof Error && error.name === 'ZodError') {
        const fieldErrors = handleQuizValidationError(error as z.ZodError);
        dispatch(setFormErrors(fieldErrors));
        return { success: false, error: 'Validation failed', fieldErrors };
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit answer';
      dispatch(setFormErrors({ general: errorMessage }));
      return { success: false, error: errorMessage };
    }
  }, [dispatch]);

  const handleValidateAnswer = useCallback((answerIndex: number) => {
    try {
      quizAnswerSchema.parse({
        selectedAnswer: answerIndex,
        questionId: 1, // Dummy ID for validation
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleClearFormErrors = useCallback(() => {
    dispatch(clearFormErrors());
  }, [dispatch]);

  const updateLocalFormState = useCallback((updates: Partial<typeof localFormState>) => {
    setLocalFormState(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    // Form handlers
    handleSubmitAnswer,
    handleValidateAnswer,
    clearFormErrors: handleClearFormErrors,
    
    // Local form state
    localFormState,
    updateLocalFormState,
  };
};