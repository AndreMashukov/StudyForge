import React, { ReactNode } from 'react';
import { QuizPageContext } from './QuizPageContext';
import { useFetchQuizData } from './hooks/api/useFetchQuizData';
import { useQuizPageHandlers } from './hooks/useQuizPageHandlers';
import { useQuizPageEffects } from './hooks/useQuizPageEffects';
import { IQuizPageContext } from '../types/IQuizPageContext';

interface IQuizPageProvider {
  children: ReactNode;
}

export const QuizPageProvider = ({ children }: IQuizPageProvider) => {
  // API hooks - self-contained, access Redux internally
  const quizApi = useFetchQuizData();
  
  // Handler hooks - self-contained business logic
  const handlers = useQuizPageHandlers();

  // Effect hooks - self-contained side effects, manage their own dependencies
  useQuizPageEffects();

  const contextValue: IQuizPageContext = {
    quizApi,    // Complete API object (no destructuring)
    handlers,   // Complete handlers object
    // DON'T include Redux state - components access directly with useSelector
  };

  return (
    <QuizPageContext.Provider value={contextValue}>
      {children}
    </QuizPageContext.Provider>
  );
};