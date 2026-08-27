import { baseApi } from '../baseApi';
import { auth } from '../../../config/firebase';
import {
  getStatisticsLearningTimeFromFirestore,
  getStatisticsOverviewFromFirestore,
  getStatisticsQuizDetailFromFirestore,
  getStatisticsQuizPerformanceFromFirestore,
} from '../../../services/statisticsFirestore';
import {
  authRequiredError,
  customError,
} from '../../../services/firestoreReadUtils';
import {
  GetStatisticsLearningTimeResponse,
  GetStatisticsOverviewResponse,
  GetStatisticsQuizDetailRequest,
  GetStatisticsQuizDetailResponse,
  GetStatisticsQuizPerformanceResponse,
  StatisticsDateRangeRequest,
} from '@shared-types';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const statisticsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStatisticsOverview: builder.query<
      GetStatisticsOverviewResponse,
      StatisticsDateRangeRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await getStatisticsOverviewFromFirestore(userId, data);
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: ['Statistics'],
    }),

    getStatisticsQuizPerformance: builder.query<
      GetStatisticsQuizPerformanceResponse,
      StatisticsDateRangeRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await getStatisticsQuizPerformanceFromFirestore(userId, data);
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: ['Statistics'],
    }),

    getStatisticsLearningTime: builder.query<
      GetStatisticsLearningTimeResponse,
      StatisticsDateRangeRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await getStatisticsLearningTimeFromFirestore(userId, data);
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: ['Statistics'],
    }),

    getStatisticsQuizDetail: builder.query<
      GetStatisticsQuizDetailResponse,
      GetStatisticsQuizDetailRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await getStatisticsQuizDetailFromFirestore(userId, data);
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
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
