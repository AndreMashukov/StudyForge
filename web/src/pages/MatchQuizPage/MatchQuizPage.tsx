import React from 'react';
import { MatchQuizPageProvider } from './context/MatchQuizPageProvider';
import { MatchQuizPageContainer } from './MatchQuizPageContainer/MatchQuizPageContainer';
import { Page } from '../../components/Page';

export const MatchQuizPage = () => {
  return (
    <MatchQuizPageProvider>
      <Page showSidebar={true}>
        <MatchQuizPageContainer />
      </Page>
    </MatchQuizPageProvider>
  );
};