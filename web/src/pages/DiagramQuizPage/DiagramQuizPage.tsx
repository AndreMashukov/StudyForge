import React from 'react';
import { DiagramQuizPageProvider } from './context/DiagramQuizPageProvider';
import { DiagramQuizPageContainer } from './DiagramQuizPageContainer';
import { Page } from '../../components/Page';

export const DiagramQuizPage = () => {
  return (
    <DiagramQuizPageProvider>
      <Page showSidebar={true}>
        <DiagramQuizPageContainer />
      </Page>
    </DiagramQuizPageProvider>
  );
};
