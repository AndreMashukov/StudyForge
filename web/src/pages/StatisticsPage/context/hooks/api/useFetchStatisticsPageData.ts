import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  GetStatisticsKnowledgeDetailRequest,
  GetStatisticsQuizDetailRequest,
  StatisticsQuizTypeFilter,
  StatisticsTimeRangeKey,
} from '@shared-types';
import {
  useGetStatisticsKnowledgeDetailQuery,
  useGetStatisticsKnowledgeGapsQuery,
  useGetStatisticsLearningTimeQuery,
  useGetStatisticsOverviewQuery,
  useGetStatisticsQuizDetailQuery,
  useGetStatisticsQuizPerformanceQuery,
} from '../../../../../store/api/Statistics';
import { IStatisticsPageApi } from '../../../types/IStatisticsPageContext';
import { getStatisticsDateRange, isQuizTelemetryType } from '../../../utils/statisticsPageUtils';

type RouteParamKey = 'quizType' | 'quizId' | 'subjectKey' | 'knowledgeDomainKey';

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

  const knowledgeDetailRequest = useMemo<GetStatisticsKnowledgeDetailRequest | null>(() => {
    if (!params.subjectKey || !params.knowledgeDomainKey) return null;
    return {
      ...request,
      subjectKey: decodeURIComponent(params.subjectKey),
      knowledgeDomainKey: decodeURIComponent(params.knowledgeDomainKey),
    };
  }, [params.subjectKey, params.knowledgeDomainKey, request]);

  const isDetailRoute = Boolean(quizDetailRequest || knowledgeDetailRequest);

  const overviewQuery = useGetStatisticsOverviewQuery(request, { skip: isDetailRoute });
  const performanceQuery = useGetStatisticsQuizPerformanceQuery(request, { skip: isDetailRoute });
  const gapsQuery = useGetStatisticsKnowledgeGapsQuery(request, { skip: isDetailRoute });
  const timeQuery = useGetStatisticsLearningTimeQuery(request, { skip: isDetailRoute });
  const quizDetailQuery = useGetStatisticsQuizDetailQuery(quizDetailRequest as GetStatisticsQuizDetailRequest, {
    skip: !quizDetailRequest,
  });
  const knowledgeDetailQuery = useGetStatisticsKnowledgeDetailQuery(
    knowledgeDetailRequest as GetStatisticsKnowledgeDetailRequest,
    { skip: !knowledgeDetailRequest }
  );

  const isLoading =
    overviewQuery.isLoading ||
    performanceQuery.isLoading ||
    gapsQuery.isLoading ||
    timeQuery.isLoading;
  const hasError = Boolean(
    overviewQuery.error || performanceQuery.error || gapsQuery.error || timeQuery.error
  );

  const refetchAll = () => {
    if (isDetailRoute) {
      if (quizDetailRequest) quizDetailQuery.refetch();
      if (knowledgeDetailRequest) knowledgeDetailQuery.refetch();
      return;
    }
    overviewQuery.refetch();
    performanceQuery.refetch();
    gapsQuery.refetch();
    timeQuery.refetch();
  };

  return {
    filters: { timeRange, quizType },
    isDetailRoute,
    quizDetailRequest,
    knowledgeDetailRequest,
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
    gaps: {
      data: gapsQuery.data,
      isLoading: gapsQuery.isLoading,
      error: gapsQuery.error,
      refetch: gapsQuery.refetch,
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
    knowledgeDetail: {
      data: knowledgeDetailQuery.data,
      isLoading: knowledgeDetailQuery.isLoading,
      error: knowledgeDetailQuery.error,
      refetch: knowledgeDetailQuery.refetch,
    },
    isLoading,
    hasError,
    setTimeRange,
    setQuizType,
    refetchAll,
  };
};
