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
    if (!formData.documentIds || formData.documentIds.length === 0) {
      return;
    }

    const ruleIds = (formData.ruleIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0
    );

    try {
      // Send a single request with all document IDs — backend combines content into one slide deck
      const result = await generateSlideDeck({
        documentIds: formData.documentIds,
        title: formData.slideDeckName?.trim() || undefined,
        additionalPrompt: formData.additionalPrompt?.trim() || undefined,
        ruleIds,
      }).unwrap();

      if (result.success && result.data) {
        dispatch(showToast({
          message: formData.documentIds.length > 1
            ? `Slide deck created from ${formData.documentIds.length} documents!`
            : 'Slide deck generated successfully!',
          type: 'success'
        }));

        if (formData.documentIds.length === 1) {
          navigate(`/slides/${result.data.slideDeckId}`);
        } else {
          navigate('/slides');
        }
      } else {
        dispatch(showToast({ message: 'Failed to generate slide deck', type: 'error' }));
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
