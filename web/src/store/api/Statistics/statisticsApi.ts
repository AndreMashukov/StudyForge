import { baseApi } from '../baseApi';
import { auth } from '../../../config/firebase';
import {
  buildGroupedFlashcardFailures,
  fetchFlashcardStudySessionsPage,
  fetchQuizAttemptsPage,
  getHiddenFailureGroupKeys,
  getStatisticsLearningTimeFromFirestore,
  getStatisticsOverviewFromFirestore,
  getStatisticsQuizDetailFromFirestore,
  getStatisticsQuizPerformanceFromFirestore,
  serializeOverviewAttempt,
} from '../../../services/statisticsFirestore';
import { hideStatisticsFailureInFirestore } from '../../../services/statisticsHiddenMutations';
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
  HideStatisticsFailureRequest,
  HideStatisticsFailureResponse,
  StatisticsAttemptsPageRequest,
  StatisticsAttemptsPageResponse,
  StatisticsDateRangeRequest,
  StatisticsFlashcardFailuresPageRequest,
  StatisticsFlashcardFailuresPageResponse,
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
          const result = await getStatisticsQuizPerformanceFromFirestore(
            userId,
            { ...data, quizType: 'all' },
          );
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

    loadMoreStatisticsAttempts: builder.mutation<
      StatisticsAttemptsPageResponse,
      StatisticsAttemptsPageRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const page = await fetchQuizAttemptsPage(
            userId,
            data,
            undefined,
            data.cursor,
            data.pageSize,
          );
          return {
            data: {
              attempts: page.attempts.map(serializeOverviewAttempt),
              nextCursor: page.nextCursor,
              hasMore: page.hasMore,
            },
          };
        } catch (error) {
          return mutationError(error);
        }
      },
    }),

    loadMoreFlashcardFailures: builder.mutation<
      StatisticsFlashcardFailuresPageResponse,
      StatisticsFlashcardFailuresPageRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const hiddenKeys = await getHiddenFailureGroupKeys(userId);
          const page = await fetchFlashcardStudySessionsPage(
            userId,
            data,
            data.cursor,
            data.pageSize,
          );
          return {
            data: {
              failures: await buildGroupedFlashcardFailures(
                userId,
                page.sessions,
                hiddenKeys,
              ),
              nextCursor: page.nextCursor,
              hasMore: page.hasMore,
            },
          };
        } catch (error) {
          return mutationError(error);
        }
      },
    }),

    hideStatisticsFailure: builder.mutation<
      HideStatisticsFailureResponse,
      HideStatisticsFailureRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const id = await hideStatisticsFailureInFirestore(userId, data);
          return { data: { id } };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: ['Statistics'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetStatisticsOverviewQuery,
  useGetStatisticsQuizPerformanceQuery,
  useGetStatisticsLearningTimeQuery,
  useGetStatisticsQuizDetailQuery,
  useLoadMoreStatisticsAttemptsMutation,
  useLoadMoreFlashcardFailuresMutation,
  useHideStatisticsFailureMutation,
} = statisticsApi;
