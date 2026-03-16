import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { ICreateQuizFormData } from '../../types/ICreateQuizPageTypes';
import { useCreateQuizPageSchema } from './useCreateQuizPageSchema';

export const useCreateQuizPageForm = () => {
  const [searchParams] = useSearchParams();
  const { schema } = useCreateQuizPageSchema();
  const preSelectedDocumentId = searchParams.get('documentId') || '';

  const form = useForm<ICreateQuizFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      documentIds: preSelectedDocumentId ? [preSelectedDocumentId] : [],
      quizName: '',
      additionalPrompt: '',
    },
  });

  // Update form when URL params change
  useEffect(() => {
    if (preSelectedDocumentId) {
      const current = form.getValues('documentIds');
      if (!current.includes(preSelectedDocumentId)) {
        form.setValue('documentIds', [preSelectedDocumentId, ...current]);
      }
    }
  }, [preSelectedDocumentId, form]);

  return form;
};
