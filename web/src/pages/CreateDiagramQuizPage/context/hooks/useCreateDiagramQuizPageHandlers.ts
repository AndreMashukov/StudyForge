import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { useGenerateDiagramQuizMutation } from '../../../../store/api/DiagramQuiz/DiagramQuizApi';
import { ICreateDiagramQuizFormData } from '../../types/ICreateDiagramQuizPageTypes';
import { useToast } from '../../../../components/Toast/ToastContext';
import { DocumentEnhanced } from '@shared-types';

interface IProps {
  form: UseFormReturn<ICreateDiagramQuizFormData>;
  documents: DocumentEnhanced[];
}

export const useCreateDiagramQuizPageHandlers = ({ form, documents }: IProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [generateDiagramQuiz, { isLoading: isSubmitting }] =
    useGenerateDiagramQuizMutation();

  const handleSubmit = useCallback(
    async (formData: ICreateDiagramQuizFormData) => {
      if (!formData.documentIds?.length) return;

      const primaryDocumentId = formData.documentIds[0];
      const primaryDocument = documents.find((d) => d.id === primaryDocumentId);
      const directoryIdFromUrl = searchParams.get('directoryId');
      const resolvedDirectoryId =
        directoryIdFromUrl ?? primaryDocument?.directoryId ?? undefined;

      try {
        const result = await generateDiagramQuiz({
          documentIds: formData.documentIds,
          directoryId: resolvedDirectoryId,
          diagramQuizName: formData.diagramQuizName?.trim() || undefined,
          additionalPrompt: formData.additionalPrompt?.trim() || undefined,
          additionalRuleIds: formData.ruleIds?.length ? formData.ruleIds : undefined,
        }).unwrap();

        if (!result?.success) {
          showToast(
            (result as { error?: { message?: string } })?.error?.message ||
              'Failed to generate diagram quiz',
            'error'
          );
          return;
        }

        showToast(
          formData.documentIds.length > 1
            ? `Diagram quiz created from ${formData.documentIds.length} documents`
            : 'Diagram quiz created',
          'success'
        );

        if (resolvedDirectoryId) {
          navigate(`/directory/${resolvedDirectoryId}?tab=diagramQuizzes`);
        } else {
          navigate('/documents');
        }
      } catch {
        showToast('Failed to generate diagram quiz', 'error');
      }
    },
    [generateDiagramQuiz, navigate, showToast, documents, searchParams]
  );

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting,
  };
};
