import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { useGenerateSlideDeckMutation } from '../../../../store/api/SlideDecks/SlideDecksApi';
import { ICreateSlideDeckFormData } from '../../types/ICreateSlideDeckPageTypes';
import { showToast } from '../../../../store/slices/uiSlice';
import { DocumentEnhanced } from '@shared-types';

interface UseCreateSlideDeckPageHandlersProps {
  form: UseFormReturn<ICreateSlideDeckFormData>;
  documents: DocumentEnhanced[];
}

export const useCreateSlideDeckPageHandlers = ({ form, documents }: UseCreateSlideDeckPageHandlersProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const [generateSlideDeck, { isLoading: isSubmitting }] = useGenerateSlideDeckMutation();

  const handleSubmit = useCallback(async (formData: ICreateSlideDeckFormData) => {
    if (!formData.documentIds || formData.documentIds.length === 0) {
      return;
    }

    const primary = documents.find((d) => d.id === formData.documentIds[0]);
    const directoryIdFromUrl = searchParams.get('directoryId');
    const resolvedDirectoryId = directoryIdFromUrl ?? primary?.directoryId;

    try {
      const result = await generateSlideDeck({
        documentIds: formData.documentIds,
        ...(resolvedDirectoryId ? { directoryId: resolvedDirectoryId } : {}),
        title: formData.slideDeckName?.trim() || undefined,
        additionalPrompt: formData.additionalPrompt?.trim() || undefined,
        ...(formData.ruleIds?.length ? { ruleIds: formData.ruleIds } : {}),
      }).unwrap();

      if (result.success && result.data) {
        dispatch(showToast({
          message: formData.documentIds.length > 1
            ? `Slide deck created from ${formData.documentIds.length} documents!`
            : 'Slide deck generated successfully!',
          type: 'success'
        }));

        if (resolvedDirectoryId) {
          navigate(`/directory/${resolvedDirectoryId}`);
        } else if (formData.documentIds.length === 1) {
          navigate(`/slides/${result.data.slideDeckId}`);
        } else {
          navigate('/documents');
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
  }, [generateSlideDeck, navigate, dispatch, documents, searchParams]);

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting,
  };
};
