import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  GetStatisticsQuizDetailRequest,
  StatisticsDateRangeRequest,
  StatisticsQuizTypeFilter,
  StatisticsTimeRangeKey,
} from '@shared-types';
import {
  useGetStatisticsLearningTimeQuery,
  useGetStatisticsOverviewQuery,
  useGetStatisticsQuizDetailQuery,
  useGetStatisticsQuizPerformanceQuery,
} from '../../../../../store/api/Statistics';
import { IStatisticsPageApi } from '../../../types/IStatisticsPageContext';
import { getStatisticsDateRange, isQuizTelemetryType } from '../../../utils/statisticsPageUtils';

type RouteParamKey = 'quizType' | 'quizId';

function buildSkippedQuizDetailRequest(
  request: StatisticsDateRangeRequest
): GetStatisticsQuizDetailRequest {
  return {
    ...request,
    quizId: '',
    quizType: 'quiz',
  };
}

export const useFetchStatisticsPageData = (): IStatisticsPageApi => {
  const params = useParams<RouteParamKey>();
  const [timeRange, setTimeRange] = useState<StatisticsTimeRangeKey>('30d');
  const [quizType, setQuizType] = useState<StatisticsQuizTypeFilter>('all');

  const request = useMemo(
    () => getStatisticsDateRange(timeRange, quizType),
    [timeRange, quizType]
  );

  const quizDetailRequest = useMemo<GetStatisticsQuizDetailRequest | null>(() => {
    if (!params.quizId || !isQuizTelemetryType(params.quizType)) return null;
    return {
      ...request,
      quizId: params.quizId,
      quizType: params.quizType,
    };
  }, [params.quizId, params.quizType, request]);

  const isDetailRoute = Boolean(quizDetailRequest);

  const overviewQuery = useGetStatisticsOverviewQuery(request, { skip: isDetailRoute });
  const performanceQuery = useGetStatisticsQuizPerformanceQuery(request, { skip: isDetailRoute });
  const timeQuery = useGetStatisticsLearningTimeQuery(request, { skip: isDetailRoute });
  const quizDetailQuery = useGetStatisticsQuizDetailQuery(
    quizDetailRequest ?? buildSkippedQuizDetailRequest(request),
    { skip: !quizDetailRequest }
  );

  const isLoading = isDetailRoute
    ? quizDetailQuery.isLoading
    : overviewQuery.isLoading || performanceQuery.isLoading || timeQuery.isLoading;
  const hasError = Boolean(
    isDetailRoute
      ? quizDetailQuery.error
      : overviewQuery.error || performanceQuery.error || timeQuery.error
  );

  const refetchAll = () => {
    if (isDetailRoute) {
      if (quizDetailRequest) quizDetailQuery.refetch();
      return;
    }
    overviewQuery.refetch();
    performanceQuery.refetch();
    timeQuery.refetch();
  };

  return {
    filters: { timeRange, quizType },
    isDetailRoute,
    quizDetailRequest,
    overview: {
      data: overviewQuery.data,
      isLoading: overviewQuery.isLoading,
      error: overviewQuery.error,
      refetch: overviewQuery.refetch,
    },
    performance: {
      data: performanceQuery.data,
      isLoading: performanceQuery.isLoading,
      error: performanceQuery.error,
      refetch: performanceQuery.refetch,
    },
    learningTime: {
      data: timeQuery.data,
      isLoading: timeQuery.isLoading,
      error: timeQuery.error,
      refetch: timeQuery.refetch,
    },
    quizDetail: {
      data: quizDetailQuery.data,
      isLoading: quizDetailQuery.isLoading,
      error: quizDetailQuery.error,
      refetch: quizDetailQuery.refetch,
    },
    isLoading,
    hasError,
    setTimeRange,
    setQuizType,
    refetchAll,
  };
};
