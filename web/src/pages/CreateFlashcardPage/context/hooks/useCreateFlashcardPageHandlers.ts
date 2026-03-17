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
    if (!formData.documentIds || formData.documentIds.length === 0) {
      return;
    }

    const trimmedTitle = formData.flashcardName?.trim();
    const trimmedPrompt = formData.additionalPrompt?.trim();

    try {
      // Send a single request with all document IDs — backend combines content into one flashcard set
      const result = await generateFlashcards({
        documentIds: formData.documentIds,
        ...(trimmedTitle ? { title: trimmedTitle } : {}),
        ...(trimmedPrompt ? { additionalPrompt: trimmedPrompt } : {}),
        ruleIds: formData.ruleIds || [],
      }).unwrap();

      if (result.success && result.data) {
        dispatch(showToast({
          message: formData.documentIds.length > 1
            ? `Flashcards created from ${formData.documentIds.length} documents!`
            : 'Flashcards generated successfully!',
          type: 'success'
        }));

        if (formData.documentIds.length === 1) {
          navigate(`/flashcards/${result.data.flashcardSetId}`);
        } else {
          navigate('/flashcards');
        }
      } else {
        dispatch(showToast({ message: 'Failed to generate flashcards', type: 'error' }));
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
