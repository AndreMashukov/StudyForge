import {
  GetStatisticsKnowledgeDetailRequest,
  GetStatisticsKnowledgeDetailResponse,
  GetStatisticsKnowledgeGapsResponse,
  GetStatisticsLearningTimeResponse,
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
  knowledgeDetailRequest: GetStatisticsKnowledgeDetailRequest | null;
  overview: IStatisticsQueryState<GetStatisticsOverviewResponse>;
  performance: IStatisticsQueryState<GetStatisticsQuizPerformanceResponse>;
  gaps: IStatisticsQueryState<GetStatisticsKnowledgeGapsResponse>;
  learningTime: IStatisticsQueryState<GetStatisticsLearningTimeResponse>;
  quizDetail: IStatisticsQueryState<GetStatisticsQuizDetailResponse>;
  knowledgeDetail: IStatisticsQueryState<GetStatisticsKnowledgeDetailResponse>;
  isLoading: boolean;
  hasError: boolean;
  setTimeRange: (range: StatisticsTimeRangeKey) => void;
  setQuizType: (type: StatisticsQuizTypeFilter) => void;
  refetchAll: () => void;
}

export interface IStatisticsPageContext {
  statisticsApi: IStatisticsPageApi;
  handlers: IStatisticsPageHandlers;
}
