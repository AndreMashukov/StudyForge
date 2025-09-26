import { useContext } from 'react';
import { DocumentViewerPageContext } from '../DocumentViewerPageContext';

export const useDocumentViewerPageContext = () => {
  const context = useContext(DocumentViewerPageContext);
  
  if (!context) {
    throw new Error('useDocumentViewerPageContext must be used within a DocumentViewerPageProvider');
  }
  
  return context;
};