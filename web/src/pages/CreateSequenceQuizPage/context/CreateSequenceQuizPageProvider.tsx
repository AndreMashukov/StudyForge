import React from 'react';
import { CreateSequenceQuizPageContext } from './CreateSequenceQuizPageContext';
import { useFetchCreateSequenceQuizPageData } from './hooks/api/useFetchCreateSequenceQuizPageData';
import { useCreateSequenceQuizPageForm } from './hooks/useCreateSequenceQuizPageForm';
import { useCreateSequenceQuizPageHandlers } from './hooks/useCreateSequenceQuizPageHandlers';
import { useCreateSequenceQuizPageEffects } from './hooks/useCreateSequenceQuizPageEffects';
import { ICreateSequenceQuizPageContext } from '../types/ICreateSequenceQuizPageContext';

export const CreateSequenceQuizPageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const documentsApi = useFetchCreateSequenceQuizPageData();
  const form = useCreateSequenceQuizPageForm();
  const documents = documentsApi.data?.documents || [];
  const handlers = useCreateSequenceQuizPageHandlers({ form, documents });
  useCreateSequenceQuizPageEffects();

  const value: ICreateSequenceQuizPageContext = {
    documentsApi: {
      data: documentsApi.data,
      isLoading: documentsApi.isLoading,
      error: documentsApi.error,
      refetch: documentsApi.refetch,
    },
    form,
    handlers,
  };

  return (
    <CreateSequenceQuizPageContext.Provider value={value}>
      {children}
    </CreateSequenceQuizPageContext.Provider>
  );
};
