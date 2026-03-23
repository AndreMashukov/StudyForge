import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { useGenerateFlashcardsMutation } from '../../../../store/api/Flashcards/FlashcardsApi';
import { ICreateFlashcardFormData } from '../../types/ICreateFlashcardPageTypes';
import { showToast } from '../../../../store/slices/uiSlice';
import { DocumentEnhanced } from '@shared-types';

interface UseCreateFlashcardPageHandlersProps {
  form: UseFormReturn<ICreateFlashcardFormData>;
  documents: DocumentEnhanced[];
}

export const useCreateFlashcardPageHandlers = ({ form, documents }: UseCreateFlashcardPageHandlersProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const [generateFlashcards, { isLoading: isSubmitting }] = useGenerateFlashcardsMutation();

  const handleSubmit = useCallback(async (formData: ICreateFlashcardFormData) => {
    if (!formData.documentIds || formData.documentIds.length === 0) {
      return;
    }

    const trimmedTitle = formData.flashcardName?.trim();
    const trimmedPrompt = formData.additionalPrompt?.trim();
    const primary = documents.find((d) => d.id === formData.documentIds[0]);
    const directoryIdFromUrl = searchParams.get('directoryId');
    const resolvedDirectoryId = directoryIdFromUrl ?? primary?.directoryId;

    try {
      const result = await generateFlashcards({
        documentIds: formData.documentIds,
        ...(resolvedDirectoryId ? { directoryId: resolvedDirectoryId } : {}),
        ...(trimmedTitle ? { title: trimmedTitle } : {}),
        ...(trimmedPrompt ? { additionalPrompt: trimmedPrompt } : {}),
        ...(formData.ruleIds?.length ? { ruleIds: formData.ruleIds } : {}),
      }).unwrap();

      if (result.success && result.data) {
        dispatch(showToast({
          message: formData.documentIds.length > 1
            ? `Flashcards created from ${formData.documentIds.length} documents!`
            : 'Flashcards generated successfully!',
          type: 'success'
        }));

        if (resolvedDirectoryId) {
          navigate(`/directory/${resolvedDirectoryId}`);
        } else if (formData.documentIds.length === 1) {
          navigate(`/flashcards/${result.data.flashcardSetId}`);
        } else {
          navigate('/documents');
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
  }, [generateFlashcards, navigate, dispatch, documents, searchParams]);

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting,
  };
};
