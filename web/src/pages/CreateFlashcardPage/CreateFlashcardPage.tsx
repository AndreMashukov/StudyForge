import React from 'react';
import { CreateFlashcardPageProvider } from './context/CreateFlashcardPageProvider';
import { CreateFlashcardPageContainer } from './CreateFlashcardPageContainer/CreateFlashcardPageContainer';

export const CreateFlashcardPage = () => {
  return (
    <CreateFlashcardPageProvider>
      <CreateFlashcardPageContainer />
    </CreateFlashcardPageProvider>
  );
};
