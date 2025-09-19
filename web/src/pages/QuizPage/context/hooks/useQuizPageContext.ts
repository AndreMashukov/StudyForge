import { useContext } from 'react';
import { QuizPageContext } from '../QuizPageContext';
import { IQuizPageContext } from '../../types/IQuizPageContext';

export const useQuizPageContext = (): IQuizPageContext => {
  const context = useContext(QuizPageContext);
  
  if (context === undefined) {
    throw new Error('useQuizPageContext must be used within a QuizPageProvider');
  }
  
  return context;
};