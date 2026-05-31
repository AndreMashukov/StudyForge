import { baseApi } from '../baseApi';
import {
  GetQuizStatsRequest,
  GetQuizStatsResponse,
  RecordQuizAttemptRequest,
  RecordQuizAttemptResponse,
  RecordQuizExplanationRequest,
  RecordQuizExplanationResponse,
} from '@shared-types';

export const learningTelemetryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    recordQuizAttempt: builder.mutation<
      RecordQuizAttemptResponse,
      RecordQuizAttemptRequest
    >({
      query: (data) => ({
        functionName: 'recordQuizAttempt',
        data,
      }),
      invalidatesTags: ['LearningStats'],
    }),

    recordQuizExplanationRequest: builder.mutation<
      RecordQuizExplanationResponse,
      RecordQuizExplanationRequest
    >({
      query: (data) => ({
        functionName: 'recordQuizExplanationRequest',
        data,
      }),
      invalidatesTags: ['LearningStats'],
    }),

    getQuizStats: builder.query<GetQuizStatsResponse, GetQuizStatsRequest>({
      query: (data) => ({
        functionName: 'getQuizStats',
        data,
      }),
      providesTags: ['LearningStats'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useRecordQuizAttemptMutation,
  useRecordQuizExplanationRequestMutation,
  useGetQuizStatsQuery,
} = learningTelemetryApi;