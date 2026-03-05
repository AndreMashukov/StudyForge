import { useContext } from 'react';
import { CreateSlideDeckPageContext } from '../CreateSlideDeckPageContext';

export const useCreateSlideDeckPageContext = () => {
  const context = useContext(CreateSlideDeckPageContext);
  
  if (!context) {
    throw new Error('useCreateSlideDeckPageContext must be used within CreateSlideDeckPageProvider');
  }
  
  return context;
};
