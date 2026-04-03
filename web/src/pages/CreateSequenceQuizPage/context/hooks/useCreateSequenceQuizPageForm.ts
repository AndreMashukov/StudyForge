import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { ICreateSequenceQuizFormData } from '../../types/ICreateSequenceQuizPageTypes';
import { useCreateSequenceQuizPageSchema } from './useCreateSequenceQuizPageSchema';

export const useCreateSequenceQuizPageForm = () => {
  const [searchParams] = useSearchParams();
  const { schema } = useCreateSequenceQuizPageSchema();
  const preSelectedDocumentId = searchParams.get('documentId') || '';

  const form = useForm<ICreateSequenceQuizFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      documentIds: preSelectedDocumentId ? [preSelectedDocumentId] : [],
      sequenceQuizName: '',
      additionalPrompt: '',
      ruleIds: [],
    },
  });

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
