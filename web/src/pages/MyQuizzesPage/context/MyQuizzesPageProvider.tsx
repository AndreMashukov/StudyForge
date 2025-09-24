import React, { ReactNode, useMemo } from 'react';
import { MyQuizzesPageContext } from './MyQuizzesPageContext';
import { useFetchMyQuizzesData } from './hooks/api/useFetchMyQuizzesData';
import { useMyQuizzesPageHandlers } from './hooks/useMyQuizzesPageHandlers';
import { useMyQuizzesPageEffects } from './hooks/useMyQuizzesPageEffects';
import { GroupedQuizzes } from '../types/IMyQuizzesPageTypes';

interface IMyQuizzesPageProvider {
  children: ReactNode;
}

export const MyQuizzesPageProvider: React.FC<IMyQuizzesPageProvider> = ({ children }) => {
  // API hooks - self-contained, access Redux internally
  const quizzesApi = useFetchMyQuizzesData();
  
  // Handler hooks - self-contained business logic
  const handlers = useMyQuizzesPageHandlers();

  // Effect hooks - self-contained side effects, manage their own dependencies
  useMyQuizzesPageEffects({
    refetchQuizzes: quizzesApi.refetch,
  });

  // Group quizzes by document title - computed data that can't be accessed elsewhere
  const groupedQuizzes: GroupedQuizzes = useMemo(() => {
    return quizzesApi.quizzes.reduce((acc, quiz) => {
      const documentTitle = quiz.documentTitle || 'Unknown Document';
      if (!acc[documentTitle]) {
        acc[documentTitle] = [];
      }
      acc[documentTitle].push(quiz);
      return acc;
    }, {} as GroupedQuizzes);
  }, [quizzesApi.quizzes]);

  const contextValue = {
    quizzesApi,    // Complete API object (no destructuring)
    handlers,      // Complete handlers object
    groupedQuizzes, // Computed data that can't be accessed elsewhere
  };

  return (
    <MyQuizzesPageContext.Provider value={contextValue}>
      {children}
    </MyQuizzesPageContext.Provider>
  );
};