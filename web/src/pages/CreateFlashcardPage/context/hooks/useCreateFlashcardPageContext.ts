import { useContext } from 'react';
import { CreateFlashcardPageContext } from '../CreateFlashcardPageContext';

export const useCreateFlashcardPageContext = () => {
  const context = useContext(CreateFlashcardPageContext);
  
  if (!context) {
    throw new Error('useCreateFlashcardPageContext must be used within CreateFlashcardPageProvider');
  }
  
  return context;
};
