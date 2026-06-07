import React, { ReactNode } from 'react';
import { CreateSubjectWorldPageContext } from './CreateSubjectWorldPageContext';
import { useFetchCreateSubjectWorldPageData } from './hooks/api/useFetchCreateSubjectWorldPageData';
import { useCreateSubjectWorldPageForm } from './hooks/useCreateSubjectWorldPageForm';
import { useCreateSubjectWorldPageHandlers } from './hooks/useCreateSubjectWorldPageHandlers';

interface ICreateSubjectWorldPageProviderProps {
  children: ReactNode;
}

export const CreateSubjectWorldPageProvider = ({ children }: ICreateSubjectWorldPageProviderProps) => {
  const documentsApi = useFetchCreateSubjectWorldPageData();
  const form = useCreateSubjectWorldPageForm();
  const handlers = useCreateSubjectWorldPageHandlers({
    form,
    documents: documentsApi.data?.documents ?? [],
  });

  return (
    <CreateSubjectWorldPageContext.Provider
      value={{
        documentsApi,
        form,
        handlers,
      }}
    >
      {children}
    </CreateSubjectWorldPageContext.Provider>
  );
};
