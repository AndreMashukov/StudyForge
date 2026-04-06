import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { useGenerateSlideDeckMutation } from '../../../../store/api/SlideDecks/SlideDecksApi';
import { ICreateSlideDeckFormData } from '../../types/ICreateSlideDeckPageTypes';
import { DocumentEnhanced } from '@shared-types';

interface UseCreateSlideDeckPageHandlersProps {
  form: UseFormReturn<ICreateSlideDeckFormData>;
  documents: DocumentEnhanced[];
}

export const useCreateSlideDeckPageHandlers = ({ form, documents }: UseCreateSlideDeckPageHandlersProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [generateSlideDeck, { isLoading: isSubmitting }] = useGenerateSlideDeckMutation();

  const handleSubmit = useCallback(async (formData: ICreateSlideDeckFormData) => {
    if (!formData.documentIds || formData.documentIds.length === 0) {
      return;
    }

    const primary = documents.find((d) => d.id === formData.documentIds[0]);
    const directoryIdFromUrl = searchParams.get('directoryId');
    const resolvedDirectoryId = directoryIdFromUrl ?? primary?.directoryId;

    if (!resolvedDirectoryId) {
      navigate('/documents');
      return;
    }

    generateSlideDeck({
      documentIds: formData.documentIds,
      directoryId: resolvedDirectoryId,
      title: formData.slideDeckName?.trim() || undefined,
      additionalPrompt: formData.additionalPrompt?.trim() || undefined,
      ...(formData.ruleIds?.length ? { ruleIds: formData.ruleIds } : {}),
    });
    navigate(`/directory/${encodeURIComponent(resolvedDirectoryId)}?tab=slides`);
  }, [generateSlideDeck, navigate, documents, searchParams]);

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting,
  };
};

