import React from 'react';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { CreateFlashcardPageProvider } from './context/CreateFlashcardPageProvider';
import { CreateFlashcardPageContainer } from './CreateFlashcardPageContainer/CreateFlashcardPageContainer';

export const CreateFlashcardPage = () => {
  return (
    <ProtectedRoute>
      <CreateFlashcardPageProvider>
        <CreateFlashcardPageContainer />
      </CreateFlashcardPageProvider>
    </ProtectedRoute>
  );
};
