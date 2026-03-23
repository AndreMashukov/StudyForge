import React from 'react';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { DirectoryDetailPageContainer } from './DirectoryDetailPageContainer';

/**
 * Route-level page shell: auth guard. Data lives in RTK Query (no page Context provider yet).
 * @see DirectoryDetailPageContainer
 */
export const DirectoryDetailPage = () => (
  <ProtectedRoute>
    <DirectoryDetailPageContainer />
  </ProtectedRoute>
);
