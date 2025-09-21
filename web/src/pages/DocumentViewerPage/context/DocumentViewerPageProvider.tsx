import React from 'react';

interface DocumentViewerPageProviderProps {
  children: React.ReactNode;
}

export const DocumentViewerPageProvider: React.FC<DocumentViewerPageProviderProps> = ({ children }) => {
  // Simple provider for now, can be enhanced later
  return <>{children}</>;
};