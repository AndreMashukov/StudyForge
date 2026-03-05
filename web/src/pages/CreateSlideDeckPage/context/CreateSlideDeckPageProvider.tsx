import React from 'react';
import { CreateSlideDeckPageContext } from './CreateSlideDeckPageContext';
import { ICreateSlideDeckPageContext } from '../types/ICreateSlideDeckPageContext';
import { useFetchCreateSlideDeckPageData } from './hooks/api/useFetchCreateSlideDeckPageData';
import { useCreateSlideDeckPageForm } from './hooks/useCreateSlideDeckPageForm';
import { useCreateSlideDeckPageHandlers } from './hooks/useCreateSlideDeckPageHandlers';
import { useCreateSlideDeckPageEffects } from './hooks/useCreateSlideDeckPageEffects';

interface CreateSlideDeckPageProviderProps {
  children: React.ReactNode;
}

export const CreateSlideDeckPageProvider: React.FC<CreateSlideDeckPageProviderProps> = ({ children }) => {
  const documentsApi = useFetchCreateSlideDeckPageData();
  const form = useCreateSlideDeckPageForm();
  const handlers = useCreateSlideDeckPageHandlers({ form });

  useCreateSlideDeckPageEffects();

  const contextValue: ICreateSlideDeckPageContext = {
    documentsApi,
    form,
    handlers,
  };

  return (
    <CreateSlideDeckPageContext.Provider value={contextValue}>
      {children}
    </CreateSlideDeckPageContext.Provider>
  );
};
