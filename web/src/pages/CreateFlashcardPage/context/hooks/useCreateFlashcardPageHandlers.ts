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
      if (formData.documentIds.length === 1) {
        // Single document: generate and navigate to the result
        const result = await generateFlashcards({
          documentId: formData.documentIds[0],
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
          ...(trimmedPrompt ? { additionalPrompt: trimmedPrompt } : {}),
          ruleIds: formData.ruleIds || [],
        }).unwrap();

        if (result.success && result.data) {
          dispatch(showToast({ message: 'Flashcards generated successfully!', type: 'success' }));
          navigate(`/flashcards/${result.data.flashcardSetId}`);
        } else {
          dispatch(showToast({ message: 'Failed to generate flashcards', type: 'error' }));
        }
      } else {
        // Multiple documents: fire all in parallel, navigate to flashcards list
        const requests = formData.documentIds.map(documentId =>
          generateFlashcards({
            documentId,
            ...(trimmedTitle ? { title: trimmedTitle } : {}),
            ...(trimmedPrompt ? { additionalPrompt: trimmedPrompt } : {}),
            ruleIds: formData.ruleIds || [],
          }).unwrap()
        );

        await Promise.all(requests);
        dispatch(showToast({
          message: `Flashcard sets generated from ${formData.documentIds.length} documents!`,
          type: 'success'
        }));
        navigate('/flashcards');
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
