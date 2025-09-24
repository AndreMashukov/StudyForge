import React, { ReactNode } from 'react';
import { HomePageContext } from './HomePageContext';
import { IHomePageContext } from '../types/IHomePageContext';
import { useHomePageHandlers } from './hooks/useHomePageHandlers';

interface IHomePageProviderProps {
  children: ReactNode;
}

export const HomePageProvider: React.FC<IHomePageProviderProps> = ({ children }) => {
  // Handler hooks - self-contained business logic
  const handlers = useHomePageHandlers();

  const contextValue: IHomePageContext = {
    handlers,
  };

  return (
    <HomePageContext.Provider value={contextValue}>
      {children}
    </HomePageContext.Provider>
  );
};