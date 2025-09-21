import React from 'react';
import { QuizPageProvider } from './context';
import { QuizPageContainer } from './QuizPageContainer';
import { Page } from '../../components/Page';

export const QuizPage: React.FC = () => {
  return (
    <QuizPageProvider>
      <Page showSidebar={true}>
        <QuizPageContainer />
      </Page>
    </QuizPageProvider>
  );
};