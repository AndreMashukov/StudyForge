import React from 'react';
import { CreateQuizPageContext } from './CreateQuizPageContext';
import { ICreateQuizPageContext } from '../types/ICreateQuizPageContext';
import { useFetchCreateQuizPageData } from './hooks/api/useFetchCreateQuizPageData';
import { useCreateQuizPageForm } from './hooks/useCreateQuizPageForm';
import { useCreateQuizPageHandlers } from './hooks/useCreateQuizPageHandlers';
import { useCreateQuizPageEffects } from './hooks/useCreateQuizPageEffects';

interface CreateQuizPageProviderProps {
  children: React.ReactNode;
}

export const CreateQuizPageProvider: React.FC<CreateQuizPageProviderProps> = ({ children }) => {
  // API hooks - self-contained, access Redux internally
  const documentsApi = useFetchCreateQuizPageData();
  
  // Form hook - React Hook Form manages form state locally
  const form = useCreateQuizPageForm();
  
  // Handler hooks - self-contained business logic
  const handlers = useCreateQuizPageHandlers({ form });

  // Effect hooks - self-contained side effects, manage their own dependencies
  useCreateQuizPageEffects();

  const contextValue: ICreateQuizPageContext = {
    documentsApi,    // Complete API object (no destructuring)
    form,           // React Hook Form instance
    handlers,        // Complete handlers object
    // DON'T include Redux state - components access directly with useSelector
  };

  return (
    <CreateQuizPageContext.Provider value={contextValue}>
      {children}
    </CreateQuizPageContext.Provider>
  );
};