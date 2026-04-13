import React from 'react';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { InteractionStatsPageContainer } from './InteractionStatsPageContainer';

export const InteractionStatsPage = () => (
  <ProtectedRoute>
    <InteractionStatsPageContainer />
  </ProtectedRoute>
);
