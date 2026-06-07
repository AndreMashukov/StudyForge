import React from 'react';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { CreateSubjectWorldPageProvider } from './context/CreateSubjectWorldPageProvider';
import { CreateSubjectWorldPageContainer } from './CreateSubjectWorldPageContainer/CreateSubjectWorldPageContainer';

export const CreateSubjectWorldPage: React.FC = () => (
  <ProtectedRoute>
    <CreateSubjectWorldPageProvider>
      <CreateSubjectWorldPageContainer />
    </CreateSubjectWorldPageProvider>
  </ProtectedRoute>
);
