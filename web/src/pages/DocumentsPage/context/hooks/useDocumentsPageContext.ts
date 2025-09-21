import { useContext } from 'react';
import { DocumentsPageContext } from '../DocumentsPageContext';

export const useDocumentsPageContext = () => {
  const context = useContext(DocumentsPageContext);
  if (context === undefined) {
    throw new Error('useDocumentsPageContext must be used within a DocumentsPageProvider');
  }
  return context;
};