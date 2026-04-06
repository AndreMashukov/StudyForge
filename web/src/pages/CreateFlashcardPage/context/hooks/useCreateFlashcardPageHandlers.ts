import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { useGenerateFlashcardsMutation } from '../../../../store/api/Flashcards/FlashcardsApi';
import { ICreateFlashcardFormData } from '../../types/ICreateFlashcardPageTypes';
import { DocumentEnhanced } from '@shared-types';

interface UseCreateFlashcardPageHandlersProps {
  form: UseFormReturn<ICreateFlashcardFormData>;
  documents: DocumentEnhanced[];
}

export const useCreateFlashcardPageHandlers = ({ form, documents }: UseCreateFlashcardPageHandlersProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

    if (!resolvedDirectoryId) {
      navigate('/documents');
      return;
    }

    generateFlashcards({
      documentIds: formData.documentIds,
      directoryId: resolvedDirectoryId,
      ...(trimmedTitle ? { title: trimmedTitle } : {}),
      ...(trimmedPrompt ? { additionalPrompt: trimmedPrompt } : {}),
      ...(formData.ruleIds?.length ? { ruleIds: formData.ruleIds } : {}),
    });
    navigate(`/directory/${encodeURIComponent(resolvedDirectoryId)}?tab=cards`);
  }, [generateFlashcards, navigate, documents, searchParams]);

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting,
  };
};

