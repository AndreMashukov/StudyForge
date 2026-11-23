import React from 'react';
import { WelcomePageContext } from './WelcomePageContext';
import type { IWelcomePageContext } from '../types/IWelcomePageContext';
import { useFetchWelcomePageData } from './hooks/api/useFetchWelcomePageData';
import { useWelcomePageHandlers } from './hooks/useWelcomePageHandlers';
import { useWelcomePageView } from './hooks/useWelcomePageView';
import { useWelcomePageEffects } from './hooks/useWelcomePageEffects';

export const WelcomePageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const data = useFetchWelcomePageData();
  const handlers = useWelcomePageHandlers();
  const { view, coursePath, samplePath } = useWelcomePageView(data, handlers);
  useWelcomePageEffects(view);

  const contextValue: IWelcomePageContext = {
    data,
    handlers,
    view,
    coursePath,
    samplePath,
  };

  return (
    <WelcomePageContext.Provider value={contextValue}>
      {children}
    </WelcomePageContext.Provider>
  );
};
