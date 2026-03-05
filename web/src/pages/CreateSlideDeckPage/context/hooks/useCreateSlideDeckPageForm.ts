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
      documentId: preSelectedDocumentId,
      slideDeckName: '',
      additionalPrompt: '',
      ruleIds: [],
    },
  });

  useEffect(() => {
    if (preSelectedDocumentId && preSelectedDocumentId !== form.getValues('documentId')) {
      form.setValue('documentId', preSelectedDocumentId);
    }
  }, [preSelectedDocumentId, form]);

  return form;
};
