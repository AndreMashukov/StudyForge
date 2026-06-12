import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatisticsQuizTypeFilter, StatisticsTimeRangeKey } from '@shared-types';
import { IStatisticsPageApi } from '../../types/IStatisticsPageContext';
import { IStatisticsPageHandlers, StatisticsTab } from '../../types/IStatisticsPageHandlers';

export const useStatisticsPageHandlers = (statisticsApi: IStatisticsPageApi): IStatisticsPageHandlers => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<StatisticsTab>('overview');

  const handleActiveTabChange = useCallback((tab: StatisticsTab) => {
    setActiveTab(tab);
  }, []);

  const handleSetTimeRange = useCallback(
    (range: StatisticsTimeRangeKey) => {
      statisticsApi.setTimeRange(range);
    },
    [statisticsApi]
  );

  const handleSetQuizType = useCallback(
    (type: StatisticsQuizTypeFilter) => {
      statisticsApi.setQuizType(type);
    },
    [statisticsApi]
  );

  const handleRefetchAll = useCallback(() => {
    statisticsApi.refetchAll();
  }, [statisticsApi]);

  const handleBackToStatistics = useCallback(() => {
    navigate('/statistics');
  }, [navigate]);

  return {
    activeTab,
    handleActiveTabChange,
    handleSetTimeRange,
    handleSetQuizType,
    handleRefetchAll,
    handleBackToStatistics,
  };
};
