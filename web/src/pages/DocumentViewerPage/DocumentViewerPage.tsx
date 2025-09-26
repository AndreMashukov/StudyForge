import React from 'react';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { DocumentViewerPageProvider } from './context';
import { DocumentViewerPageContainer } from './DocumentViewerPageContainer';

export const DocumentViewerPage = () => {
  return (
    <ProtectedRoute>
      <DocumentViewerPageProvider>
        <DocumentViewerPageContainer />
      </DocumentViewerPageProvider>
    </ProtectedRoute>
  );
};