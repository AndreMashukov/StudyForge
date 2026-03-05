import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { useGenerateSlideDeckMutation } from '../../../../store/api/SlideDecks/SlideDecksApi';
import { ICreateSlideDeckFormData } from '../../types/ICreateSlideDeckPageTypes';
import { showToast } from '../../../../store/slices/uiSlice';

interface UseCreateSlideDeckPageHandlersProps {
  form: UseFormReturn<ICreateSlideDeckFormData>;
}

export const useCreateSlideDeckPageHandlers = ({ form }: UseCreateSlideDeckPageHandlersProps) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [generateSlideDeck, { isLoading: isSubmitting }] = useGenerateSlideDeckMutation();

  const handleSubmit = useCallback(async (formData: ICreateSlideDeckFormData) => {
    if (!formData.documentId) {
      return;
    }

    try {
      const result = await generateSlideDeck({
        documentId: formData.documentId,
        title: formData.slideDeckName?.trim() || undefined,
        additionalPrompt: formData.additionalPrompt?.trim() || undefined,
        ruleIds: formData.ruleIds || [],
      }).unwrap();

      if (result.success && result.data) {
        dispatch(showToast({
          message: 'Slide deck generated successfully!',
          type: 'success'
        }));

        navigate(`/slides/${result.data.slideDeckId}`);
      } else {
        dispatch(showToast({
          message: 'Failed to generate slide deck',
          type: 'error'
        }));
      }
    } catch (error) {
      console.error('Error generating slide deck:', error);
      dispatch(showToast({
        message: error instanceof Error ? error.message : 'Failed to generate slide deck',
        type: 'error'
      }));
    }
  }, [generateSlideDeck, navigate, dispatch]);

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting,
  };
};
