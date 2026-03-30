import React from 'react';
import { CreateDiagramQuizPageContext } from './CreateDiagramQuizPageContext';
import { useFetchCreateDiagramQuizPageData } from './hooks/api/useFetchCreateDiagramQuizPageData';
import { useCreateDiagramQuizPageForm } from './hooks/useCreateDiagramQuizPageForm';
import { useCreateDiagramQuizPageHandlers } from './hooks/useCreateDiagramQuizPageHandlers';
import { useCreateDiagramQuizPageEffects } from './hooks/useCreateDiagramQuizPageEffects';
import { ICreateDiagramQuizPageContext } from '../types/ICreateDiagramQuizPageContext';

export const CreateDiagramQuizPageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const documentsApi = useFetchCreateDiagramQuizPageData();
  const form = useCreateDiagramQuizPageForm();
  const documents = documentsApi.data?.documents || [];
  const handlers = useCreateDiagramQuizPageHandlers({ form, documents });
  useCreateDiagramQuizPageEffects();

  const value: ICreateDiagramQuizPageContext = {
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
    <CreateDiagramQuizPageContext.Provider value={value}>
      {children}
    </CreateDiagramQuizPageContext.Provider>
  );
};
