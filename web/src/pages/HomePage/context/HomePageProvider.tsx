import type { ReactNode } from 'react';
import { HomePageContext } from './HomePageContext';
import { useFetchHomePageData } from './hooks/api/useFetchHomePageData';
import { useHomePageHandlers } from './hooks/useHomePageHandlers';
import { useHomePageEffects } from './hooks/useHomePageEffects';

interface IHomePageProviderProps {
  children: ReactNode;
}

export const HomePageProvider = ({ children }: IHomePageProviderProps) => {
  const api = useFetchHomePageData();
  const handlers = useHomePageHandlers();
  useHomePageEffects();
  return (
    <HomePageContext.Provider value={{ api, handlers }}>
      {children}
    </HomePageContext.Provider>
  );
};
