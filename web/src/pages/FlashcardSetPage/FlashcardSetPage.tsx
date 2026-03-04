import React from 'react';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { FlashcardSetPageProvider } from './context/FlashcardSetPageProvider';
import { FlashcardSetPageContainer } from './FlashcardSetPageContainer';

export const FlashcardSetPage = () => (
  <ProtectedRoute>
    <FlashcardSetPageProvider>
      <FlashcardSetPageContainer />
    </FlashcardSetPageProvider>
  </ProtectedRoute>
);
