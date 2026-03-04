import React from 'react';
import { FlashcardsPageContext } from './FlashcardsPageContext';
import { IFlashcardsPageContext } from '../types/IFlashcardsPageContext';
import { useFetchFlashcardsPageData } from './hooks/api/useFetchFlashcardsPageData';
import { useFlashcardsPageHandlers } from './hooks/useFlashcardsPageHandlers';

interface FlashcardsPageProviderProps {
  children: React.ReactNode;
}

export const FlashcardsPageProvider: React.FC<FlashcardsPageProviderProps> = ({ children }) => {
  const api = useFetchFlashcardsPageData();
  const handlers = useFlashcardsPageHandlers();

  const contextValue: IFlashcardsPageContext = { api, handlers };

  return (
    <FlashcardsPageContext.Provider value={contextValue}>
      {children}
    </FlashcardsPageContext.Provider>
  );
};
