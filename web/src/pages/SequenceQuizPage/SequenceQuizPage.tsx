import React from 'react';
import { SequenceQuizPageProvider } from './context/SequenceQuizPageProvider';
import { SequenceQuizPageContainer } from './SequenceQuizPageContainer/SequenceQuizPageContainer';
import { Page } from '../../components/Page';

export const SequenceQuizPage = () => {
  return (
    <SequenceQuizPageProvider>
      <Page showSidebar={true}>
        <SequenceQuizPageContainer />
      </Page>
    </SequenceQuizPageProvider>
  );
};
