import { useContext } from 'react';
import { StatisticsPageContext } from '../StatisticsPageContext';

export const useStatisticsPageContext = () => {
  const context = useContext(StatisticsPageContext);
  if (context === undefined) {
    throw new Error('useStatisticsPageContext must be used within a StatisticsPageProvider');
  }
  return context;
};
