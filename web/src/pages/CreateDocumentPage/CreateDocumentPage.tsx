import React from 'react';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { CreateDocumentPageProvider } from './context/CreateDocumentPageProvider';
import { CreateDocumentPageContainer } from './CreateDocumentPageContainer';

export const CreateDocumentPage = () => {
  return (
    <ProtectedRoute>
      <CreateDocumentPageProvider>
        <CreateDocumentPageContainer />
      </CreateDocumentPageProvider>
    </ProtectedRoute>
  );
};