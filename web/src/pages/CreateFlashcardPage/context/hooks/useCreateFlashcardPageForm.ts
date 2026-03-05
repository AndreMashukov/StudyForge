import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { ICreateFlashcardFormData } from '../../types/ICreateFlashcardPageTypes';
import { useCreateFlashcardPageSchema } from './useCreateFlashcardPageSchema';

export const useCreateFlashcardPageForm = () => {
  const [searchParams] = useSearchParams();
  const { schema } = useCreateFlashcardPageSchema();
  const preSelectedDocumentId = searchParams.get('documentId') || '';

  const form = useForm<ICreateFlashcardFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      documentId: preSelectedDocumentId,
      flashcardName: '',
      additionalPrompt: '',
    },
  });

  useEffect(() => {
    if (preSelectedDocumentId && preSelectedDocumentId !== form.getValues('documentId')) {
      form.setValue('documentId', preSelectedDocumentId);
    }
  }, [preSelectedDocumentId, form]);

  return form;
};
