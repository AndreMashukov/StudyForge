import React from 'react';
import { SlideDecksPageProvider } from './context/SlideDecksPageProvider';
import { SlideDecksPageContainer } from './SlideDecksPageContainer/SlideDecksPageContainer';

export const SlideDecksPage: React.FC = () => {
  return (
    <SlideDecksPageProvider>
      <SlideDecksPageContainer />
    </SlideDecksPageProvider>
  );
};
