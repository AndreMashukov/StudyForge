import { useContext } from 'react';
import { SequenceQuizPageContext } from '../SequenceQuizPageContext';

export const useSequenceQuizPageContext = () => {
  const ctx = useContext(SequenceQuizPageContext);
  if (!ctx) {
    throw new Error('useSequenceQuizPageContext must be used within SequenceQuizPageProvider');
  }
  return ctx;
};
