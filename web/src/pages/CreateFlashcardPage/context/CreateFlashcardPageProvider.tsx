import React from 'react';
import { CreateFlashcardPageContext } from './CreateFlashcardPageContext';
import { ICreateFlashcardPageContext } from '../types/ICreateFlashcardPageContext';
import { useFetchCreateFlashcardPageData } from './hooks/api/useFetchCreateFlashcardPageData';
import { useCreateFlashcardPageForm } from './hooks/useCreateFlashcardPageForm';
import { useCreateFlashcardPageHandlers } from './hooks/useCreateFlashcardPageHandlers';
import { useCreateFlashcardPageEffects } from './hooks/useCreateFlashcardPageEffects';

interface CreateFlashcardPageProviderProps {
  children: React.ReactNode;
}

export const CreateFlashcardPageProvider: React.FC<CreateFlashcardPageProviderProps> = ({ children }) => {
  const documentsApi = useFetchCreateFlashcardPageData();
  const form = useCreateFlashcardPageForm();
  const documents = documentsApi.data?.documents || [];
  const handlers = useCreateFlashcardPageHandlers({ form, documents });

  useCreateFlashcardPageEffects();

  const contextValue: ICreateFlashcardPageContext = {
    documentsApi,
    form,
    handlers,
  };

  return (
    <CreateFlashcardPageContext.Provider value={contextValue}>
      {children}
    </CreateFlashcardPageContext.Provider>
  );
};
