import { baseApi } from '../baseApi';
import {
  GetStatisticsKnowledgeDetailRequest,
  GetStatisticsKnowledgeDetailResponse,
  GetStatisticsKnowledgeGapsResponse,
  GetStatisticsLearningTimeResponse,
  GetStatisticsOverviewResponse,
  GetStatisticsQuizDetailRequest,
  GetStatisticsQuizDetailResponse,
  GetStatisticsQuizPerformanceResponse,
  StatisticsDateRangeRequest,
} from '@shared-types';

export const statisticsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStatisticsOverview: builder.query<
      GetStatisticsOverviewResponse,
      StatisticsDateRangeRequest
    >({
      query: (data) => ({
        functionName: 'getStatisticsOverview',
        data,
      }),
      providesTags: ['Statistics'],
    }),

    getStatisticsQuizPerformance: builder.query<
      GetStatisticsQuizPerformanceResponse,
      StatisticsDateRangeRequest
    >({
      query: (data) => ({
        functionName: 'getStatisticsQuizPerformance',
        data,
      }),
      providesTags: ['Statistics'],
    }),

    getStatisticsKnowledgeGaps: builder.query<
      GetStatisticsKnowledgeGapsResponse,
      StatisticsDateRangeRequest
    >({
      query: (data) => ({
        functionName: 'getStatisticsKnowledgeGaps',
        data,
      }),
      providesTags: ['Statistics'],
    }),

    getStatisticsLearningTime: builder.query<
      GetStatisticsLearningTimeResponse,
      StatisticsDateRangeRequest
    >({
      query: (data) => ({
        functionName: 'getStatisticsLearningTime',
        data,
      }),
      providesTags: ['Statistics'],
    }),

    getStatisticsQuizDetail: builder.query<
      GetStatisticsQuizDetailResponse,
      GetStatisticsQuizDetailRequest
    >({
      query: (data) => ({
        functionName: 'getStatisticsQuizDetail',
        data,
      }),
      providesTags: ['Statistics'],
    }),

    getStatisticsKnowledgeDetail: builder.query<
      GetStatisticsKnowledgeDetailResponse,
      GetStatisticsKnowledgeDetailRequest
    >({
      query: (data) => ({
        functionName: 'getStatisticsKnowledgeDetail',
        data,
      }),
      providesTags: ['Statistics'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetStatisticsOverviewQuery,
  useGetStatisticsQuizPerformanceQuery,
  useGetStatisticsKnowledgeGapsQuery,
  useGetStatisticsLearningTimeQuery,
  useGetStatisticsQuizDetailQuery,
  useGetStatisticsKnowledgeDetailQuery,
} = statisticsApi;