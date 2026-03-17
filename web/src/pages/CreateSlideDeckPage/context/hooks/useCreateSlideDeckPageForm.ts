import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { ICreateSlideDeckFormData } from '../../types/ICreateSlideDeckPageTypes';
import { useCreateSlideDeckPageSchema } from './useCreateSlideDeckPageSchema';

export const useCreateSlideDeckPageForm = () => {
  const [searchParams] = useSearchParams();
  const { schema } = useCreateSlideDeckPageSchema();
  const preSelectedDocumentId = searchParams.get('documentId') || '';

  const form = useForm<ICreateSlideDeckFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      documentIds: preSelectedDocumentId ? [preSelectedDocumentId] : [],
      slideDeckName: '',
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
