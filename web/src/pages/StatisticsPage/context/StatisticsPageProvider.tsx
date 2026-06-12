import React, { ReactNode } from 'react';
import { StatisticsPageContext } from './StatisticsPageContext';
import { useFetchStatisticsPageData } from './hooks/api/useFetchStatisticsPageData';
import { useStatisticsPageHandlers } from './hooks/useStatisticsPageHandlers';
import { IStatisticsPageContext } from '../types/IStatisticsPageContext';

interface IStatisticsPageProvider {
  children: ReactNode;
}

export const StatisticsPageProvider: React.FC<IStatisticsPageProvider> = ({ children }) => {
  const statisticsApi = useFetchStatisticsPageData();
  const handlers = useStatisticsPageHandlers(statisticsApi);

  const contextValue: IStatisticsPageContext = {
    statisticsApi,
    handlers,
  };

  return (
    <StatisticsPageContext.Provider value={contextValue}>
      {children}
    </StatisticsPageContext.Provider>
  );
};
