import { useContext } from 'react';
import { MatchQuizPageContext } from '../MatchQuizPageContext';

export const useMatchQuizPageContext = () => {
  const ctx = useContext(MatchQuizPageContext);
  if (!ctx) {
    throw new Error('useMatchQuizPageContext must be used within MatchQuizPageProvider');
  }
  return ctx;
};