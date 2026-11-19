import React, { ReactNode } from 'react';
import { SlideDeckPageContext } from './SlideDeckPageContext';
import { useFetchSlideDeckData } from './hooks/api/useFetchSlideDeckData';
import { useSlideDeckPageHandlers } from './hooks/useSlideDeckPageHandlers';
import { useSlideDeckFullscreenHandlers } from './hooks/useSlideDeckFullscreenHandlers';
import { useSlideDeckDownloadHandlers } from './hooks/useSlideDeckDownloadHandlers';
import { useSlideDeckPageEffects } from './hooks/useSlideDeckPageEffects';
import { ISlideDeckPageContext } from '../types/ISlideDeckPageContext';
import { useInteractionTracker } from '../../../hooks/useInteractionTracker';

interface ISlideDeckPageProvider {
  children: ReactNode;
}

export const SlideDeckPageProvider: React.FC<ISlideDeckPageProvider> = ({ children }) => {
  const slideDeckApi = useFetchSlideDeckData();
  const slidesLength = slideDeckApi.slideDeck?.slides?.length ?? 0;

  const handlers = useSlideDeckPageHandlers({
    directoryIdFromData: slideDeckApi.slideDeck?.directoryId,
    slidesLength,
  });
  const fullscreen = useSlideDeckFullscreenHandlers();
  const download = useSlideDeckDownloadHandlers({
    slideDeck: slideDeckApi.slideDeck,
    currentSlide: handlers.currentSlide,
  });

  useSlideDeckPageEffects({ slidesLength, handlers, fullscreen });

  useInteractionTracker({
    artifactId: slideDeckApi.slideDeck?.id,
    artifactType: 'slideDeck',
    directoryId: slideDeckApi.slideDeck?.directoryId,
  });

  const contextValue: ISlideDeckPageContext = { slideDeckApi, handlers, fullscreen, download };

  return (
    <SlideDeckPageContext.Provider value={contextValue}>
      {children}
    </SlideDeckPageContext.Provider>
  );
};
