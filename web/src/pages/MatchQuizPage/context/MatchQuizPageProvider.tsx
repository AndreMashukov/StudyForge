import React, { ReactNode } from 'react';
import { MatchQuizPageContext } from './MatchQuizPageContext';
import { useFetchMatchQuizData } from './hooks/api/useFetchMatchQuizData';
import { useMatchQuizPageHandlers } from './hooks/useMatchQuizPageHandlers';
import { useMatchQuizPageEffects } from './hooks/useMatchQuizPageEffects';
import { IMatchQuizPageContext } from '../types/IMatchQuizPageContext';
import { useInteractionTracker } from '../../../hooks/useInteractionTracker';

interface IMatchQuizPageProviderProps {
  children: ReactNode;
}

export const MatchQuizPageProvider = ({ children }: IMatchQuizPageProviderProps) => {
  const fetchApi = useFetchMatchQuizData();
  const handlers = useMatchQuizPageHandlers();
  useMatchQuizPageEffects();

  useInteractionTracker({
    artifactId: fetchApi.firestoreMatchQuiz?.id,
    artifactType: 'matchQuiz',
    directoryId: fetchApi.firestoreMatchQuiz?.directoryId,
  });

  const matchQuizApi: IMatchQuizPageContext['matchQuizApi'] = {
    firestoreMatchQuiz: fetchApi.firestoreMatchQuiz,
    questions: fetchApi.questions,
    isLoading: fetchApi.isLoading,
    isFetching: fetchApi.isFetching,
    error: fetchApi.error,
    isError: fetchApi.isError,
    isSuccess: fetchApi.isSuccess,
    refetch: fetchApi.refetch,
    hasValidId: fetchApi.hasValidId,
    matchQuizId: fetchApi.matchQuizId,
  };

  const contextValue: IMatchQuizPageContext = {
    matchQuizApi,
    handlers,
  };

  return (
    <MatchQuizPageContext.Provider value={contextValue}>
      {children}
    </MatchQuizPageContext.Provider>
  );
};