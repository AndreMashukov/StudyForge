import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { useGenerateQuizMutation } from '../../../../store/api/Quiz/QuizApi';
import { ICreateQuizFormData } from '../../types/ICreateQuizPageTypes';
import { useToast } from '../../../../components/Toast/ToastContext';
import { DocumentEnhanced } from '@shared-types';

interface UseCreateQuizPageHandlersProps {
  form: UseFormReturn<ICreateQuizFormData>;
  documents: DocumentEnhanced[];
}

export const useCreateQuizPageHandlers = ({ form, documents }: UseCreateQuizPageHandlersProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [generateQuiz, { isLoading: isSubmitting }] = useGenerateQuizMutation();

  const handleSubmit = useCallback(async (formData: ICreateQuizFormData) => {
    if (!formData.documentIds || formData.documentIds.length === 0) {
      return;
    }

    const primaryDocumentId = formData.documentIds[0];
    const primaryDocument = documents.find(d => d.id === primaryDocumentId);
    const directoryIdFromUrl = searchParams.get('directoryId');
    const resolvedDirectoryId =
      directoryIdFromUrl ?? primaryDocument?.directoryId ?? undefined;

    try {
      await generateQuiz({
        documentIds: formData.documentIds,
        directoryId: resolvedDirectoryId,
        quizName: formData.quizName?.trim() || undefined,
        additionalPrompt: formData.additionalPrompt?.trim() || undefined,
      }).unwrap();

      showToast(
        formData.documentIds.length > 1
          ? `Quiz created from ${formData.documentIds.length} documents`
          : 'Quiz created',
        'success'
      );

      if (resolvedDirectoryId) {
        navigate(`/directory/${resolvedDirectoryId}`);
      } else {
        navigate('/documents');
      }
    } catch {
      showToast('Failed to generate quiz', 'error');
    }
  }, [generateQuiz, navigate, showToast, documents, searchParams]);

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting,
  };
};
