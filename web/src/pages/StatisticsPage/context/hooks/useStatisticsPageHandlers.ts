import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../hooks/redux';
import { setStatisticsTab } from '../../../../store/slices/statisticsPageSlice';
import { useNavigate } from 'react-router-dom';
import {
  HideStatisticsFailureRequest,
  StatisticsQuizTypeFilter,
  StatisticsTimeRangeKey,
} from '@shared-types';
import { useHideStatisticsFailureMutation } from '../../../../store/api/Statistics';
import { IStatisticsPageApi } from '../../types/IStatisticsPageContext';
import {
  IStatisticsPageHandlers,
  StatisticsTab,
} from '../../types/IStatisticsPageHandlers';

export const useStatisticsPageHandlers = (
  statisticsApi: IStatisticsPageApi,
): IStatisticsPageHandlers => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector((state) => state.statisticsPage.activeTab);
  const [hideStatisticsFailure] = useHideStatisticsFailureMutation();

  const handleActiveTabChange = useCallback(
    (tab: StatisticsTab) => {
      dispatch(setStatisticsTab(tab));
    },
    [dispatch],
  );

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
    handleHideFailure,
    isLoadingMoreAttempts: statisticsApi.isLoadingMoreAttempts,
  };
};
