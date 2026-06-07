import { useContext } from 'react';
import { CreateSubjectWorldPageContext } from '../CreateSubjectWorldPageContext';

export const useCreateSubjectWorldPageContext = () => {
  const context = useContext(CreateSubjectWorldPageContext);
  if (!context) {
    throw new Error('useCreateSubjectWorldPageContext must be used within CreateSubjectWorldPageProvider');
  }
  return context;
};
