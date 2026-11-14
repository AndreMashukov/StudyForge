import {
  GetStatisticsOverviewResponse,
  GetStatisticsQuizDetailRequest,
  GetStatisticsQuizDetailResponse,
  GetStatisticsQuizPerformanceResponse,
  StatisticsQuizTypeFilter,
  StatisticsTimeRangeKey,
} from '@shared-types';
import { IStatisticsPageHandlers } from './IStatisticsPageHandlers';

export interface IStatisticsQueryState<T> {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export interface IStatisticsPageApi {
  filters: {
    timeRange: StatisticsTimeRangeKey;
    quizType: StatisticsQuizTypeFilter;
  };
  isDetailRoute: boolean;
  quizDetailRequest: GetStatisticsQuizDetailRequest | null;
  overview: IStatisticsQueryState<GetStatisticsOverviewResponse>;
  performance: IStatisticsQueryState<GetStatisticsQuizPerformanceResponse>;
  quizDetail: IStatisticsQueryState<GetStatisticsQuizDetailResponse>;
  isLoadingMoreAttempts: boolean;
  loadMoreError: string | null;
  loadMoreAttempts: () => Promise<void>;
  setTimeRange: (range: StatisticsTimeRangeKey) => void;
  setQuizType: (type: StatisticsQuizTypeFilter) => void;
}

export interface IStatisticsPageContext {
  statisticsApi: IStatisticsPageApi;
  handlers: IStatisticsPageHandlers;
}
