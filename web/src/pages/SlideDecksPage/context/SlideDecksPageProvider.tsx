import React, { ReactNode } from 'react';
import { SlideDecksPageContext } from './SlideDecksPageContext';
import { useFetchSlideDecksData } from './hooks/api/useFetchSlideDecksData';
import { useSlideDecksPageHandlers } from './hooks/useSlideDecksPageHandlers';
import { ISlideDecksPageContext } from '../types/ISlideDecksPageContext';

interface ISlideDecksPageProvider {
  children: ReactNode;
}

export const SlideDecksPageProvider: React.FC<ISlideDecksPageProvider> = ({ children }) => {
  const slideDecksApi = useFetchSlideDecksData();
  const handlers = useSlideDecksPageHandlers();

  const contextValue: ISlideDecksPageContext = { slideDecksApi, handlers };

  return (
    <SlideDecksPageContext.Provider value={contextValue}>
      {children}
    </SlideDecksPageContext.Provider>
  );
};
