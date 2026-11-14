import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { GetStatisticsQuizDetailRequest } from '@shared-types';
import { useAppDispatch, useAppSelector } from '../../../../../hooks/redux';
import {
  useGetStatisticsOverviewQuery,
  useGetStatisticsQuizDetailQuery,
  useGetStatisticsQuizPerformanceQuery,
} from '../../../../../store/api/Statistics';
import {
  loadMoreStatistics,
  setStatisticsQuizType,
  setStatisticsTimeRange,
} from '../../../../../store/slices/statisticsPageSlice';
import type { IStatisticsPageApi } from '../../../types/IStatisticsPageContext';
import {
  getStatisticsDateRange,
  isQuizTelemetryType,
} from '../../../utils/statisticsPageUtils';

export const useFetchStatisticsPageData = (): IStatisticsPageApi => {
  const params = useParams<'quizType' | 'quizId'>();
  const dispatch = useAppDispatch();
  const { timeRange, quizType, attemptLimit } = useAppSelector(
    (state) => state.statisticsPage,
  );
  const request = useMemo(
    () => getStatisticsDateRange(timeRange, quizType),
    [timeRange, quizType],
  );
  const quizDetailRequest =
    useMemo<GetStatisticsQuizDetailRequest | null>(() => {
      if (!params.quizId || !isQuizTelemetryType(params.quizType)) return null;
      return { ...request, quizId: params.quizId, quizType: params.quizType };
    }, [params.quizId, params.quizType, request]);
  const isDetailRoute = Boolean(quizDetailRequest);
  const overviewQuery = useGetStatisticsOverviewQuery(
    { ...request, attemptLimit },
    { skip: isDetailRoute },
  );
  const performanceQuery = useGetStatisticsQuizPerformanceQuery(request, {
    skip: isDetailRoute,
  });
  const quizDetailQuery = useGetStatisticsQuizDetailQuery(
    quizDetailRequest ?? { ...request, quizId: '', quizType: 'quiz' },
    { skip: !quizDetailRequest },
  );
  const overviewData = overviewQuery.currentData;
  return {
    filters: { timeRange, quizType },
    isDetailRoute,
    quizDetailRequest,
    overview: {
      data: overviewData,
      isLoading: overviewQuery.isFetching && !overviewData,
      error: overviewQuery.error,
      refetch: overviewQuery.refetch,
    },
    performance: {
      data: performanceQuery.currentData,
      isLoading: performanceQuery.isFetching && !performanceQuery.currentData,
      error: performanceQuery.error,
      refetch: performanceQuery.refetch,
    },
    quizDetail: {
      data: quizDetailQuery.currentData,
      isLoading: quizDetailQuery.isFetching && !quizDetailQuery.currentData,
      error: quizDetailQuery.error,
      refetch: quizDetailQuery.refetch,
    },
    isLoadingMoreAttempts: Boolean(overviewData && overviewQuery.isFetching),
    loadMoreError:
      overviewData && overviewQuery.error
        ? 'Could not refresh questions. Please try again.'
        : null,
    loadMoreAttempts: async () => {
      if (overviewQuery.error) {
        await overviewQuery.refetch();
        return;
      }
      if (overviewData?.hasMoreAttempts && !overviewQuery.isFetching)
        dispatch(loadMoreStatistics());
    },
    setTimeRange: (range) => {
      dispatch(setStatisticsTimeRange(range));
    },
    setQuizType: (type) => {
      dispatch(setStatisticsQuizType(type));
    },
  };
};
