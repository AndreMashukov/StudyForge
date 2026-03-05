import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { useGenerateFlashcardsMutation } from '../../../../store/api/Flashcards/FlashcardsApi';
import { ICreateFlashcardFormData } from '../../types/ICreateFlashcardPageTypes';
import { showToast } from '../../../../store/slices/uiSlice';

interface UseCreateFlashcardPageHandlersProps {
  form: UseFormReturn<ICreateFlashcardFormData>;
}

export const useCreateFlashcardPageHandlers = ({ form }: UseCreateFlashcardPageHandlersProps) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [generateFlashcards, { isLoading: isSubmitting }] = useGenerateFlashcardsMutation();

  const handleSubmit = useCallback(async (formData: ICreateFlashcardFormData) => {
    if (!formData.documentId) {
      return;
    }

    try {
      const trimmedTitle = formData.flashcardName?.trim();
      const trimmedPrompt = formData.additionalPrompt?.trim();
      const result = await generateFlashcards({
        documentId: formData.documentId,
        ...(trimmedTitle ? { title: trimmedTitle } : {}),
        ...(trimmedPrompt ? { additionalPrompt: trimmedPrompt } : {}),
        ruleIds: formData.ruleIds || [],
      }).unwrap();
      
      if (result.success && result.data) {
        dispatch(showToast({
          message: 'Flashcards generated successfully!',
          type: 'success'
        }));
        
        navigate(`/flashcards/${result.data.flashcardSetId}`);
      } else {
        dispatch(showToast({
          message: 'Failed to generate flashcards',
          type: 'error'
        }));
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
      dispatch(showToast({
        message: error instanceof Error ? error.message : 'Failed to generate flashcards',
        type: 'error'
      }));
    }
  }, [generateFlashcards, navigate, dispatch]);

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting,
  };
};
