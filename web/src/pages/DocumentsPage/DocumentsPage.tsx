import React from 'react';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { DocumentsPageProvider } from './context/DocumentsPageProvider';
import { DocumentsPageContainer } from './DocumentsPageContainer';

export const DocumentsPage = () => {
  return (
    <ProtectedRoute>
      <DocumentsPageProvider>
        <DocumentsPageContainer />
      </DocumentsPageProvider>
    </ProtectedRoute>
  );
};