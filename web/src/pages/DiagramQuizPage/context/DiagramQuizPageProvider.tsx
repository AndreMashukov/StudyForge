import React, { ReactNode } from 'react';
import { DiagramQuizPageContext } from './DiagramQuizPageContext';
import { useFetchDiagramQuizData } from './hooks/api/useFetchDiagramQuizData';
import { useDiagramQuizPageHandlers } from './hooks/useDiagramQuizPageHandlers';
import { useDiagramQuizPageEffects } from './hooks/useDiagramQuizPageEffects';
import { IDiagramQuizPageContext } from '../types/IDiagramQuizPageContext';

interface IDiagramQuizPageProviderProps {
  children: ReactNode;
}

export const DiagramQuizPageProvider = ({ children }: IDiagramQuizPageProviderProps) => {
  const fetchApi = useFetchDiagramQuizData();
  const handlers = useDiagramQuizPageHandlers();
  useDiagramQuizPageEffects();

  const diagramQuizApi: IDiagramQuizPageContext['diagramQuizApi'] = {
    firestoreDiagramQuiz: fetchApi.firestoreDiagramQuiz,
    questions: fetchApi.questions,
    isLoading: fetchApi.isLoading,
    isFetching: fetchApi.isFetching,
    error: fetchApi.error,
    isError: fetchApi.isError,
    isSuccess: fetchApi.isSuccess,
    refetch: fetchApi.refetch,
    hasValidId: fetchApi.hasValidId,
    diagramQuizId: fetchApi.diagramQuizId,
  };

  const contextValue: IDiagramQuizPageContext = {
    diagramQuizApi,
    handlers: {
      handleAnswerSelect: handlers.handleAnswerSelect,
      handleNextQuestion: handlers.handleNextQuestion,
      handleResetQuiz: handlers.handleResetQuiz,
      handleCompleteQuiz: handlers.handleCompleteQuiz,
      handlePrevDiagram: handlers.handlePrevDiagram,
      handleNextDiagram: handlers.handleNextDiagram,
      handleDiagramDotClick: handlers.handleDiagramDotClick,
      handleGenerateFollowup: handlers.handleGenerateFollowup,
    },
  };

  return (
    <DiagramQuizPageContext.Provider value={contextValue}>
      {children}
    </DiagramQuizPageContext.Provider>
  );
};
