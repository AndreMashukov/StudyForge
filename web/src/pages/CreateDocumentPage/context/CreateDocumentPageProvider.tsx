import React from 'react';
import { CreateDocumentPageContext } from './CreateDocumentPageContext';
import { ICreateDocumentPageContext } from '../types/ICreateDocumentPageContext';
import { useCreateDocumentPageHandlers } from './hooks/useCreateDocumentPageHandlers';

interface CreateDocumentPageProviderProps {
  children: React.ReactNode;
}

export const CreateDocumentPageProvider: React.FC<CreateDocumentPageProviderProps> = ({ children }) => {
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