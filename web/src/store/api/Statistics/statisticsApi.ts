import { baseApi } from '../baseApi';
import {
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
  }),
  overrideExisting: false,
});

export const {
  useGetStatisticsOverviewQuery,
  useGetStatisticsQuizPerformanceQuery,
  useGetStatisticsLearningTimeQuery,
  useGetStatisticsQuizDetailQuery,
} = statisticsApi;
