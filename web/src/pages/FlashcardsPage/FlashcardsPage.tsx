import React from 'react';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { FlashcardsPageProvider } from './context/FlashcardsPageProvider';
import { FlashcardsPageContainer } from './FlashcardsPageContainer';

export const FlashcardsPage = () => (
  <ProtectedRoute>
    <FlashcardsPageProvider>
      <FlashcardsPageContainer />
    </FlashcardsPageProvider>
  </ProtectedRoute>
);
