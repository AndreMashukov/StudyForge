import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HideStatisticsFailureRequest, StatisticsQuizTypeFilter, StatisticsTimeRangeKey } from '@shared-types';
import { useHideStatisticsFailureMutation } from '../../../../store/api/Statistics';
import { IStatisticsPageApi } from '../../types/IStatisticsPageContext';
import { IStatisticsPageHandlers, StatisticsTab } from '../../types/IStatisticsPageHandlers';

export const useStatisticsPageHandlers = (statisticsApi: IStatisticsPageApi): IStatisticsPageHandlers => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<StatisticsTab>('overview');
  const [hideStatisticsFailure] = useHideStatisticsFailureMutation();

  const handleActiveTabChange = useCallback((tab: StatisticsTab) => {
    setActiveTab(tab);
  }, []);

  const handleSetTimeRange = useCallback(
    (range: StatisticsTimeRangeKey) => {
      statisticsApi.setTimeRange(range);
    },
    [statisticsApi],
  );

  const handleSetQuizType = useCallback(
    (type: StatisticsQuizTypeFilter) => {
      statisticsApi.setQuizType(type);
    },
    [statisticsApi],
  );

  const handleBackToStatistics = useCallback(() => {
    navigate('/statistics');
  }, [navigate]);

  const handleLoadMoreAttempts = useCallback(async () => {
    await statisticsApi.loadMoreAttempts();
  }, [statisticsApi]);

  const handleLoadMoreFlashcardFailures = useCallback(async () => {
    await statisticsApi.loadMoreFlashcardFailures();
  }, [statisticsApi]);

  const handleHideFailure = useCallback(
    async (request: HideStatisticsFailureRequest) => {
      await hideStatisticsFailure(request).unwrap();
    },
    [hideStatisticsFailure],
  );

  return {
    activeTab,
    handleActiveTabChange,
    handleSetTimeRange,
    handleSetQuizType,
    handleBackToStatistics,
    handleLoadMoreAttempts,
    handleLoadMoreFlashcardFailures,
    handleHideFailure,
    isLoadingMoreAttempts: statisticsApi.isLoadingMoreAttempts,
    isLoadingMoreFlashcards: statisticsApi.isLoadingMoreFlashcards,
  };
};
