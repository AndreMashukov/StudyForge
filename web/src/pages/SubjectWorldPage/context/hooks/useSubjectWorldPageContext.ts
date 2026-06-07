import { useContext } from 'react';
import { SubjectWorldPageContext } from '../SubjectWorldPageContext';

export const useSubjectWorldPageContext = () => {
  const context = useContext(SubjectWorldPageContext);
  if (!context) {
    throw new Error('useSubjectWorldPageContext must be used within SubjectWorldPageProvider');
  }
  return context;
};
