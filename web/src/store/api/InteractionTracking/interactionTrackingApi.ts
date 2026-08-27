import { baseApi } from '../baseApi';
import { auth } from '../../../config/firebase';
import {
  flushInteractionSessionInFirestore,
  getInteractionStatsFromFirestore,
} from '../../../services/interactionTrackingMutations';
import {
  authRequiredError,
  customError,
} from '../../../services/firestoreReadUtils';
import {
  FlushInteractionSessionRequest,
  FlushInteractionSessionResponse,
  GetInteractionStatsRequest,
  GetInteractionStatsResponse,
} from '@shared-types';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const interactionTrackingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    flushInteractionSession: builder.mutation<
      FlushInteractionSessionResponse,
      FlushInteractionSessionRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const sessionId = await flushInteractionSessionInFirestore(userId, data);
          return { data: { sessionId } };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: ['InteractionStats'],
    }),

    getInteractionStats: builder.query<
      GetInteractionStatsResponse,
      GetInteractionStatsRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const stats = await getInteractionStatsFromFirestore(userId, data);
          return { data: { stats } };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: ['InteractionStats'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useFlushInteractionSessionMutation,
  useGetInteractionStatsQuery,
} = interactionTrackingApi;
