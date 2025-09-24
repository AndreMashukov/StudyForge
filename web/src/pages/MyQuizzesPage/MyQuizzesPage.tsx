import React from 'react';
import { MyQuizzesPageProvider } from './context/MyQuizzesPageProvider';
import { MyQuizzesPageContainer } from './MyQuizzesPageContainer/MyQuizzesPageContainer';

export const MyQuizzesPage: React.FC = () => {
  return (
    <MyQuizzesPageProvider>
      <MyQuizzesPageContainer />
    </MyQuizzesPageProvider>
  );
};