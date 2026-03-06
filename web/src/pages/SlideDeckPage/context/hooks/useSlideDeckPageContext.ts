import { useContext } from 'react';
import { SlideDeckPageContext } from '../SlideDeckPageContext';
import { ISlideDeckPageContext } from '../../types/ISlideDeckPageContext';

export const useSlideDeckPageContext = (): ISlideDeckPageContext => {
  const context = useContext(SlideDeckPageContext);
  if (!context) {
    throw new Error('useSlideDeckPageContext must be used within SlideDeckPageProvider');
  }
  return context;
};
