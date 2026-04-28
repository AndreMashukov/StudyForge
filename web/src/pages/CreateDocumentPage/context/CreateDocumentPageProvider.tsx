import React from 'react';
import { CreateDocumentPageContext } from './CreateDocumentPageContext';
import { ICreateDocumentPageContext } from '../types/ICreateDocumentPageContext';
import { useCreateDocumentPageHandlers } from './hooks/useCreateDocumentPageHandlers';
import { useCreateDocumentPageEffects } from './hooks/useCreateDocumentPageEffects';

interface CreateDocumentPageProviderProps {
  children: React.ReactNode;
}

export const CreateDocumentPageProvider: React.FC<CreateDocumentPageProviderProps> = ({ children }) => {
  // Reset page state on mount/unmount so each visit starts fresh
  useCreateDocumentPageEffects();

  // Handler hooks - self-contained business logic
  const handlers = useCreateDocumentPageHandlers();

  const contextValue: ICreateDocumentPageContext = {
    handlers,
  };

  return (
    <CreateDocumentPageContext.Provider value={contextValue}>
      {children}
    </CreateDocumentPageContext.Provider>
  );
};