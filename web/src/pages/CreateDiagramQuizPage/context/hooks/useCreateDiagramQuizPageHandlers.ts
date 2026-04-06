import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { useGenerateDiagramQuizMutation } from '../../../../store/api/DiagramQuiz/DiagramQuizApi';
import { ICreateDiagramQuizFormData } from '../../types/ICreateDiagramQuizPageTypes';
import { DocumentEnhanced } from '@shared-types';

interface IProps {
  form: UseFormReturn<ICreateDiagramQuizFormData>;
  documents: DocumentEnhanced[];
}

export const useCreateDiagramQuizPageHandlers = ({ form, documents }: IProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

      if (!resolvedDirectoryId) {
        navigate('/documents');
        return;
      }

      generateDiagramQuiz({
        documentIds: formData.documentIds,
        directoryId: resolvedDirectoryId,
        diagramQuizName: formData.diagramQuizName?.trim() || undefined,
        additionalPrompt: formData.additionalPrompt?.trim() || undefined,
        additionalRuleIds: formData.ruleIds?.length ? formData.ruleIds : undefined,
      });
      navigate(`/directory/${encodeURIComponent(resolvedDirectoryId)}?tab=diagramQuizzes`);
    },
    [generateDiagramQuiz, navigate, documents, searchParams]
  );

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting,
  };
};
