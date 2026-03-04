import { useContext } from 'react';
import { FlashcardSetPageContext } from '../FlashcardSetPageContext';
import { IFlashcardSetPageContext } from '../../types/IFlashcardSetPageContext';

export const useFlashcardSetPageContext = (): IFlashcardSetPageContext => {
  const context = useContext(FlashcardSetPageContext);
  if (!context) {
    throw new Error('useFlashcardSetPageContext must be used within FlashcardSetPageProvider');
  }
  return context;
};
