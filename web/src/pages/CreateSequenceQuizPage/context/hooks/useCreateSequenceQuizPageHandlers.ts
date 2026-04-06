import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { useGenerateSequenceQuizMutation } from '../../../../store/api/SequenceQuiz/SequenceQuizApi';
import { ICreateSequenceQuizFormData } from '../../types/ICreateSequenceQuizPageTypes';
import { DocumentEnhanced } from '@shared-types';

interface IProps {
  form: UseFormReturn<ICreateSequenceQuizFormData>;
  documents: DocumentEnhanced[];
}

export const useCreateSequenceQuizPageHandlers = ({ form, documents }: IProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [generateSequenceQuiz, { isLoading: isSubmitting }] =
    useGenerateSequenceQuizMutation();

  const handleSubmit = useCallback(
    async (formData: ICreateSequenceQuizFormData) => {
      if (!formData.documentIds?.length) return;

      const primaryDocumentId = formData.documentIds[0];
      const primaryDocument = documents.find((d) => d.id === primaryDocumentId);
      const directoryIdFromUrl = searchParams.get('directoryId')?.trim() || undefined;
      const resolvedDirectoryId =
        directoryIdFromUrl ?? primaryDocument?.directoryId ?? undefined;

      if (!resolvedDirectoryId) {
        navigate('/documents');
        return;
      }

      generateSequenceQuiz({
        documentIds: formData.documentIds,
        directoryId: resolvedDirectoryId,
        sequenceQuizName: formData.sequenceQuizName?.trim() || undefined,
        additionalPrompt: formData.additionalPrompt?.trim() || undefined,
        additionalRuleIds: formData.ruleIds?.length ? formData.ruleIds : undefined,
      });
      navigate(`/directory/${encodeURIComponent(resolvedDirectoryId)}?tab=sequenceQuizzes`);
    },
    [generateSequenceQuiz, navigate, documents, searchParams]
  );

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting,
  };
};
