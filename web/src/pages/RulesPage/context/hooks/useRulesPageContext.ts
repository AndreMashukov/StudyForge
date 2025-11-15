import { useContext } from 'react';
import { RulesPageContext } from '../RulesPageContext';

export const useRulesPageContext = () => {
  const context = useContext(RulesPageContext);
  
  if (!context) {
    throw new Error('useRulesPageContext must be used within RulesPageProvider');
  }
  
  return context;
};
