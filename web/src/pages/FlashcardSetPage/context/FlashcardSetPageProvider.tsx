import React from 'react';
import { FlashcardSetPageContext } from './FlashcardSetPageContext';
import { IFlashcardSetPageContext } from '../types/IFlashcardSetPageContext';
import { useFetchFlashcardSetData } from './hooks/api/useFetchFlashcardSetData';
import { useFlashcardSetPageHandlers } from './hooks/useFlashcardSetPageHandlers';

interface FlashcardSetPageProviderProps {
  children: React.ReactNode;
}

export const FlashcardSetPageProvider: React.FC<FlashcardSetPageProviderProps> = ({ children }) => {
  const api = useFetchFlashcardSetData();
  const handlers = useFlashcardSetPageHandlers(api.flashcardSet?.directoryId);

  const contextValue: IFlashcardSetPageContext = { api, handlers };

  return (
    <FlashcardSetPageContext.Provider value={contextValue}>
      {children}
    </FlashcardSetPageContext.Provider>
  );
};
