import { useContext } from 'react';
import { CreateQuizPageContext } from '../CreateQuizPageContext';

export const useCreateQuizPageContext = () => {
  const context = useContext(CreateQuizPageContext);
  
  if (!context) {
    throw new Error('useCreateQuizPageContext must be used within CreateQuizPageProvider');
  }
  
  return context;
};