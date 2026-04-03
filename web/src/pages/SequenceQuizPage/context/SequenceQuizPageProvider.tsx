import React, { ReactNode } from 'react';
import { SequenceQuizPageContext } from './SequenceQuizPageContext';
import { useFetchSequenceQuizData } from './hooks/api/useFetchSequenceQuizData';
import { useSequenceQuizPageHandlers } from './hooks/useSequenceQuizPageHandlers';
import { useSequenceQuizPageEffects } from './hooks/useSequenceQuizPageEffects';
import { ISequenceQuizPageContext } from '../types/ISequenceQuizPageContext';

interface ISequenceQuizPageProviderProps {
  children: ReactNode;
}

export const SequenceQuizPageProvider = ({ children }: ISequenceQuizPageProviderProps) => {
  const fetchApi = useFetchSequenceQuizData();
  const handlers = useSequenceQuizPageHandlers();
  useSequenceQuizPageEffects();

  const sequenceQuizApi: ISequenceQuizPageContext['sequenceQuizApi'] = {
    firestoreSequenceQuiz: fetchApi.firestoreSequenceQuiz,
    questions: fetchApi.questions,
    isLoading: fetchApi.isLoading,
    isFetching: fetchApi.isFetching,
    error: fetchApi.error,
    isError: fetchApi.isError,
    isSuccess: fetchApi.isSuccess,
    refetch: fetchApi.refetch,
    hasValidId: fetchApi.hasValidId,
    sequenceQuizId: fetchApi.sequenceQuizId,
  };

  const contextValue: ISequenceQuizPageContext = {
    sequenceQuizApi,
    handlers,
  };

  return (
    <SequenceQuizPageContext.Provider value={contextValue}>
      {children}
    </SequenceQuizPageContext.Provider>
  );
};
