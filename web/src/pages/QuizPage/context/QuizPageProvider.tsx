import React, { ReactNode } from 'react';
import { QuizPageContext } from './QuizPageContext';
import { useQuizPageHandlers } from './hooks/useQuizPageHandlers';
import { useQuizPageEffects } from './hooks/useQuizPageEffects';
import { IQuizPageContext } from '../types/IQuizPageContext';

interface IQuizPageProvider {
  children: ReactNode;
}

export const QuizPageProvider = ({ children }: IQuizPageProvider) => {
  // Handler hooks - self-contained business logic
  const handlers = useQuizPageHandlers();

  // Effect hooks - self-contained side effects
  useQuizPageEffects({
    onQuizStart: () => {
      console.log('Quiz started');
    },
    onQuestionChange: (questionIndex: number) => {
      console.log(`Question changed to index: ${questionIndex}`);
    },
    onAnswerSubmit: (answer) => {
      console.log('Answer submitted:', answer);
    },
    onQuizComplete: (quizStats) => {
      console.log('Quiz completed with stats:', quizStats);
    },
    onTimeUpdate: (currentTime) => {
      // Could dispatch time updates to Redux if needed
      // console.log('Time update:', currentTime);
    },
  });

  const contextValue: IQuizPageContext = {
    handlers,
  };

  return (
    <QuizPageContext.Provider value={contextValue}>
      {children}
    </QuizPageContext.Provider>
  );
};