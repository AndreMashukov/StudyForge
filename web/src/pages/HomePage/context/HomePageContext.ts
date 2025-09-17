import { createContext, useContext } from 'react';
import { IHomePageContext } from '../types/IHomePageContext';

export const HomePageContext = createContext<IHomePageContext | null>(null);

export const useHomePageContext = () => {
  const context = useContext(HomePageContext);
  if (!context) {
    throw new Error('useHomePageContext must be used within a HomePageProvider');
  }
  return context;
};