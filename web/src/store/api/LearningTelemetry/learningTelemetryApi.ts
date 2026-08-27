import { baseApi } from '../baseApi';
import { auth } from '../../../config/firebase';
import {
  recordQuizAttemptInFirestore,
  recordQuizExplanationRequestInFirestore,
  getQuizStatsFromFirestore,
} from '../../../services/learningTelemetryMutations';
import {
  authRequiredError,
  customError,
} from '../../../services/firestoreReadUtils';
import {
  GetQuizStatsRequest,
  GetQuizStatsResponse,
  RecordQuizAttemptRequest,
  RecordQuizAttemptResponse,
  RecordQuizExplanationRequest,
  RecordQuizExplanationResponse,
} from '@shared-types';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const learningTelemetryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    recordQuizAttempt: builder.mutation<
      RecordQuizAttemptResponse,
      RecordQuizAttemptRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const attemptId = await recordQuizAttemptInFirestore(userId, data);
          return { data: { attemptId } };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: ['LearningStats', 'Statistics'],
    }),

    recordQuizExplanationRequest: builder.mutation<
      RecordQuizExplanationResponse,
      RecordQuizExplanationRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const eventId = await recordQuizExplanationRequestInFirestore(userId, data);
          return { data: { eventId } };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: ['LearningStats', 'Statistics'],
    }),

    getQuizStats: builder.query<GetQuizStatsResponse, GetQuizStatsRequest>({
      async queryFn({ quizId, quizType }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const stats = await getQuizStatsFromFirestore(userId, quizType, quizId);
          return { data: { stats } };
        } catch (error) {
          return mutationError(error);
        }
      },
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
