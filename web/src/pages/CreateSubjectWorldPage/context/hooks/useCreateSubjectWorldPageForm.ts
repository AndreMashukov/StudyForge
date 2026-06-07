import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { ICreateSubjectWorldFormData } from '../../types/ICreateSubjectWorldPageTypes';
import { createSubjectWorldPageSchema } from './useCreateSubjectWorldPageSchema';

export const useCreateSubjectWorldPageForm = () => {
  const [searchParams] = useSearchParams();
  const preselectedDocumentId = searchParams.get('documentId');

  const form = useForm<ICreateSubjectWorldFormData>({
    resolver: zodResolver(createSubjectWorldPageSchema),
    defaultValues: {
      documentIds: preselectedDocumentId ? [preselectedDocumentId] : [],
      subjectWorldName: '',
      additionalPrompt: '',
      ruleIds: [],
      followupRuleIds: [],
    },
  });

  useEffect(() => {
    if (preselectedDocumentId) {
      form.setValue('documentIds', [preselectedDocumentId]);
    }
  }, [preselectedDocumentId, form]);

  return form;
};
