import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { ICreateDiagramQuizFormData } from '../../types/ICreateDiagramQuizPageTypes';
import { useCreateDiagramQuizPageSchema } from './useCreateDiagramQuizPageSchema';

export const useCreateDiagramQuizPageForm = () => {
  const [searchParams] = useSearchParams();
  const { schema } = useCreateDiagramQuizPageSchema();
  const preSelectedDocumentId = searchParams.get('documentId') || '';

  const form = useForm<ICreateDiagramQuizFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      documentIds: preSelectedDocumentId ? [preSelectedDocumentId] : [],
      diagramQuizName: '',
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
