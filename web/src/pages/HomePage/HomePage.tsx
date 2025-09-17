import React from 'react';
import { HomePageContainer } from './HomePageContainer';
import { HomePageProvider } from './context/HomePageProvider';

export const HomePage: React.FC = () => {
  return (
    <HomePageProvider>
      <HomePageContainer />
    </HomePageProvider>
  );
};