import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { showToast } = useToast();
  const [generateQuiz, { isLoading: isSubmitting }] = useGenerateQuizMutation();

  const handleSubmit = useCallback(async (formData: ICreateQuizFormData) => {
    if (!formData.documentIds || formData.documentIds.length === 0) {
      return;
    }

    // Use the first document to determine directoryId for navigation
    const primaryDocumentId = formData.documentIds[0];
    const primaryDocument = documents.find(d => d.id === primaryDocumentId);
    const directoryId = primaryDocument?.directoryId ?? null;

    // Fire a quiz generation request for each selected document in parallel
    // (backend currently accepts one documentId at a time)
    void Promise.all(
      formData.documentIds.map(documentId =>
        generateQuiz({
          documentId,
          quizName: formData.quizName?.trim() || undefined,
          additionalPrompt: formData.additionalPrompt?.trim() || undefined,
          quizRuleIds: formData.quizRuleIds || [],
          followupRuleIds: formData.followupRuleIds || [],
        }).unwrap().catch(() => showToast(`Failed to generate quiz for document ${documentId}`, 'error'))
      )
    );

    showToast(
      formData.documentIds.length > 1
        ? `Quiz creation started for ${formData.documentIds.length} documents`
        : 'Quiz creation started',
      'info'
    );

    if (directoryId) {
      navigate(`/documents?directoryId=${directoryId}`);
    } else {
      navigate('/documents');
    }
  }, [generateQuiz, navigate, showToast, documents]);

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting,
  };
};
