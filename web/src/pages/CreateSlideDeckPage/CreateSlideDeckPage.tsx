import React from 'react';
import { CreateSlideDeckPageProvider } from './context/CreateSlideDeckPageProvider';
import { CreateSlideDeckPageContainer } from './CreateSlideDeckPageContainer/CreateSlideDeckPageContainer';

export const CreateSlideDeckPage = () => {
  return (
    <CreateSlideDeckPageProvider>
      <CreateSlideDeckPageContainer />
    </CreateSlideDeckPageProvider>
  );
};
