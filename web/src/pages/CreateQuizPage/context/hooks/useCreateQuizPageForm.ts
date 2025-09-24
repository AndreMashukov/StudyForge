import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { ICreateQuizFormData } from '../../../store/slices/createQuizPageSlice';
import { useCreateQuizPageSchema } from './useCreateQuizPageSchema';

export const useCreateQuizPageForm = () => {
  const [searchParams] = useSearchParams();
  const { schema } = useCreateQuizPageSchema();
  const preSelectedDocumentId = searchParams.get('documentId') || '';

  const form = useForm<ICreateQuizFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      documentId: preSelectedDocumentId,
      quizName: '',
      additionalPrompt: '',
    },
  });

  // Update form when URL params change
  useEffect(() => {
    if (preSelectedDocumentId && preSelectedDocumentId !== form.getValues('documentId')) {
      form.setValue('documentId', preSelectedDocumentId);
    }
  }, [preSelectedDocumentId, form]);

  return form;
};