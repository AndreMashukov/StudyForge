import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { useGenerateSequenceQuizMutation } from '../../../../store/api/SequenceQuiz/SequenceQuizApi';
import { ICreateSequenceQuizFormData } from '../../types/ICreateSequenceQuizPageTypes';
import { useToast } from '../../../../components/Toast/ToastContext';
import { DocumentEnhanced } from '@shared-types';

interface IProps {
  form: UseFormReturn<ICreateSequenceQuizFormData>;
  documents: DocumentEnhanced[];
}

export const useCreateSequenceQuizPageHandlers = ({ form, documents }: IProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
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

      try {
        const result = await generateSequenceQuiz({
          documentIds: formData.documentIds,
          directoryId: resolvedDirectoryId,
          sequenceQuizName: formData.sequenceQuizName?.trim() || undefined,
          additionalPrompt: formData.additionalPrompt?.trim() || undefined,
          additionalRuleIds: formData.ruleIds?.length ? formData.ruleIds : undefined,
        }).unwrap();

        if (!result?.success) {
          showToast(
            (result as { error?: { message?: string } })?.error?.message ||
              'Failed to generate sequence quiz',
            'error'
          );
          return;
        }

        showToast(
          formData.documentIds.length > 1
            ? `Sequence quiz created from ${formData.documentIds.length} documents`
            : 'Sequence quiz created',
          'success'
        );

        if (resolvedDirectoryId?.trim()) {
          navigate(`/directory/${encodeURIComponent(resolvedDirectoryId)}?tab=sequenceQuizzes`);
        } else {
          navigate('/documents');
        }
      } catch {
        showToast('Failed to generate sequence quiz', 'error');
      }
    },
    [generateSequenceQuiz, navigate, showToast, documents, searchParams]
  );

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting,
  };
};
