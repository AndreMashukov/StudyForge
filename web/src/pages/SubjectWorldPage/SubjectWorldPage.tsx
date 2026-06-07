import React from 'react';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { SubjectWorldPageProvider } from './context/SubjectWorldPageProvider';
import { SubjectWorldPageContainer } from './SubjectWorldPageContainer/SubjectWorldPageContainer';

export const SubjectWorldPage: React.FC = () => (
  <ProtectedRoute>
    <SubjectWorldPageProvider>
      <SubjectWorldPageContainer />
    </SubjectWorldPageProvider>
  </ProtectedRoute>
);
