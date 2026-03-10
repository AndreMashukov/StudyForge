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
  const [generateQuiz] = useGenerateQuizMutation();

  const handleSubmit = useCallback(async (formData: ICreateQuizFormData) => {
    if (!formData.documentId) {
      return;
    }

    const selectedDocument = documents.find(d => d.id === formData.documentId);
    const directoryId = selectedDocument?.directoryId || null;

    generateQuiz({
      documentId: formData.documentId,
      quizName: formData.quizName?.trim() || undefined,
      additionalPrompt: formData.additionalPrompt?.trim() || undefined,
      quizRuleIds: formData.quizRuleIds || [],
      followupRuleIds: formData.followupRuleIds || [],
    })
      .unwrap()
      .catch(() => showToast('Failed to generate quiz', 'error'));

    showToast('Quiz creation started', 'info');

    if (directoryId) {
      navigate(`/documents?directoryId=${directoryId}`);
    } else {
      navigate('/documents');
    }
  }, [generateQuiz, navigate, showToast, documents]);

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
  };
};