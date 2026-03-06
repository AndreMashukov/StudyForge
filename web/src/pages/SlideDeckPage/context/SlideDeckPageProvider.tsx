import React, { ReactNode } from 'react';
import { SlideDeckPageContext } from './SlideDeckPageContext';
import { useFetchSlideDeckData } from './hooks/api/useFetchSlideDeckData';
import { useSlideDeckPageHandlers } from './hooks/useSlideDeckPageHandlers';
import { useSlideDeckPageEffects } from './hooks/useSlideDeckPageEffects';
import { ISlideDeckPageContext } from '../types/ISlideDeckPageContext';

interface ISlideDeckPageProvider {
  children: ReactNode;
}

export const SlideDeckPageProvider: React.FC<ISlideDeckPageProvider> = ({ children }) => {
  const slideDeckApi = useFetchSlideDeckData();
  const handlers = useSlideDeckPageHandlers();

  useSlideDeckPageEffects({
    slidesLength: slideDeckApi.slideDeck?.slides?.length ?? 0,
    handlers,
  });

  const contextValue: ISlideDeckPageContext = { slideDeckApi, handlers };

  return (
    <SlideDeckPageContext.Provider value={contextValue}>
      {children}
    </SlideDeckPageContext.Provider>
  );
};
