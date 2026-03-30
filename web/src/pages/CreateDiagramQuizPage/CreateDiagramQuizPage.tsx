import React from 'react';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { CreateDiagramQuizPageProvider } from './context/CreateDiagramQuizPageProvider';
import { CreateDiagramQuizPageContainer } from './CreateDiagramQuizPageContainer/CreateDiagramQuizPageContainer';

export const CreateDiagramQuizPage = () => {
  return (
    <ProtectedRoute>
      <CreateDiagramQuizPageProvider>
        <CreateDiagramQuizPageContainer />
      </CreateDiagramQuizPageProvider>
    </ProtectedRoute>
  );
};
