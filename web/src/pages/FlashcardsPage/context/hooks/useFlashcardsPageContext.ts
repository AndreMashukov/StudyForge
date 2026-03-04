import { useContext } from 'react';
import { FlashcardsPageContext } from '../FlashcardsPageContext';
import { IFlashcardsPageContext } from '../../types/IFlashcardsPageContext';

export const useFlashcardsPageContext = (): IFlashcardsPageContext => {
  const context = useContext(FlashcardsPageContext);
  if (!context) {
    throw new Error('useFlashcardsPageContext must be used within FlashcardsPageProvider');
  }
  return context;
};
