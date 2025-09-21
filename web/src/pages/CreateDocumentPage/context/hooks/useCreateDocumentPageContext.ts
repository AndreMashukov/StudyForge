import { useContext } from 'react';
import { CreateDocumentPageContext } from '../CreateDocumentPageContext';

export const useCreateDocumentPageContext = () => {
  const context = useContext(CreateDocumentPageContext);
  if (context === undefined) {
    throw new Error('useCreateDocumentPageContext must be used within a CreateDocumentPageProvider');
  }
  return context;
};