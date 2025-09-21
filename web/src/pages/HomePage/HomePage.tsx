import React from 'react';
import { HomePageContainer } from './HomePageContainer';
import { HomePageProvider } from './context/HomePageProvider';
import { Page } from '../../components/Page';

export const HomePage: React.FC = () => {
  return (
    <HomePageProvider>
      <Page showSidebar={true}>
        <HomePageContainer />
      </Page>
    </HomePageProvider>
  );
};