import React from 'react';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { CreateQuizPageProvider } from './context/CreateQuizPageProvider';
import { CreateQuizPageContainer } from './CreateQuizPageContainer/CreateQuizPageContainer';

export const CreateQuizPage = () => {
  return (
    <ProtectedRoute>
      <CreateQuizPageProvider>
        <CreateQuizPageContainer />
      </CreateQuizPageProvider>
    </ProtectedRoute>
  );
};