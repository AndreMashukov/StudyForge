import { useContext } from 'react';
import { SlideDecksPageContext } from '../SlideDecksPageContext';
import { ISlideDecksPageContext } from '../../types/ISlideDecksPageContext';

export const useSlideDecksPageContext = (): ISlideDecksPageContext => {
  const context = useContext(SlideDecksPageContext);
  if (!context) {
    throw new Error('useSlideDecksPageContext must be used within SlideDecksPageProvider');
  }
  return context;
};
