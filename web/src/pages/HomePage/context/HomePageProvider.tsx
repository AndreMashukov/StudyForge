import React, { ReactNode } from 'react';
import { HomePageContext } from './HomePageContext';
import { IHomePageContext } from '../types/IHomePageContext';
import { useHomePageForm } from './hooks/useHomePageForm';
import { useHomePageHandlers } from './hooks/useHomePageHandlers';
import { useFetchQuizzes } from './hooks/api/useFetchQuizzes';

interface IHomePageProviderProps {
  children: ReactNode;
}

export const HomePageProvider: React.FC<IHomePageProviderProps> = ({ children }) => {
  const { urlForm, actions } = useHomePageForm();
  const handlers = useHomePageHandlers();
  const { userQuizzes, recentQuizzes } = useFetchQuizzes();

  // Enhance handlers with form actions
  const enhancedHandlers = {
    ...handlers,
    handleGenerateQuiz: async (url: string) => {
      actions.setGenerating(true);
      const result = await handlers.handleGenerateQuiz(url);
      actions.setGenerating(false);
      
      if (!result.success) {
        actions.setError(result.error || 'Failed to generate quiz');
      } else {
        actions.resetForm();
        // Refetch quizzes to show the new quiz
        userQuizzes.refetch();
        recentQuizzes.refetch();
      }
      
      return result;
    },
  };

  const contextValue: IHomePageContext = {
    urlForm,
    userQuizzes,
    recentQuizzes,
    handlers: enhancedHandlers,
  };

  return (
    <HomePageContext.Provider value={contextValue}>
      {children}
    </HomePageContext.Provider>
  );
};