import React from 'react';
import { SlideDeckPageProvider } from './context/SlideDeckPageProvider';
import { SlideDeckPageContainer } from './SlideDeckPageContainer/SlideDeckPageContainer';

export const SlideDeckPage: React.FC = () => {
  return (
    <SlideDeckPageProvider>
      <SlideDeckPageContainer />
    </SlideDeckPageProvider>
  );
};
