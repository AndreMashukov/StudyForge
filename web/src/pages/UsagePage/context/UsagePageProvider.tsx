import React from 'react';
import { UsagePageContext } from './UsagePageContext';
import type { IUsagePageContext } from '../types/IUsagePageContext';
import { useFetchUsagePageData } from './hooks/api/useFetchUsagePageData';
import { useUsagePageHandlers } from './hooks/useUsagePageHandlers';

export const UsagePageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const usage = useFetchUsagePageData();
  const handlers = useUsagePageHandlers();

  const contextValue: IUsagePageContext = { usage, handlers };

  return <UsagePageContext.Provider value={contextValue}>{children}</UsagePageContext.Provider>;
};
