import React from 'react';
import { UsagePageContext } from './UsagePageContext';
import type { IUsagePageContext } from '../types/IUsagePageContext';
import { useFetchUsagePageData } from './hooks/api/useFetchUsagePageData';

export const UsagePageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const usage = useFetchUsagePageData();

  const contextValue: IUsagePageContext = { usage };

  return <UsagePageContext.Provider value={contextValue}>{children}</UsagePageContext.Provider>;
};
