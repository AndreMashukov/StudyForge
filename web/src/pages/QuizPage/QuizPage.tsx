import React from 'react';
import { QuizPageProvider } from './context';
import { QuizPageContainer } from './QuizPageContainer';

export const QuizPage: React.FC = () => {
  return (
    <QuizPageProvider>
      <QuizPageContainer />
    </QuizPageProvider>
  );
};