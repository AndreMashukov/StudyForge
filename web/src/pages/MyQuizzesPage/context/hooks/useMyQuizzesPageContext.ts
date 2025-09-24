import { useContext } from 'react';
import { MyQuizzesPageContext } from '../MyQuizzesPageContext';
import { IMyQuizzesPageContext } from '../../types/IMyQuizzesPageTypes';

export const useMyQuizzesPageContext = (): IMyQuizzesPageContext => {
  const context = useContext(MyQuizzesPageContext);
  
  if (!context) {
    throw new Error('useMyQuizzesPageContext must be used within a MyQuizzesPageProvider');
  }
  
  return context;
};