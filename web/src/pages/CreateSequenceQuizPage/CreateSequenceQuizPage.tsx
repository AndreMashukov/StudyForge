import React from 'react';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { CreateSequenceQuizPageProvider } from './context/CreateSequenceQuizPageProvider';
import { CreateSequenceQuizPageContainer } from './CreateSequenceQuizPageContainer/CreateSequenceQuizPageContainer';

export const CreateSequenceQuizPage = () => {
  return (
    <ProtectedRoute>
      <CreateSequenceQuizPageProvider>
        <CreateSequenceQuizPageContainer />
      </CreateSequenceQuizPageProvider>
    </ProtectedRoute>
  );
};
