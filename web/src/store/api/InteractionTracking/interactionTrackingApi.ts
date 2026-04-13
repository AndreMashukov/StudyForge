import { baseApi } from '../baseApi';
import {
  FlushInteractionSessionRequest,
  FlushInteractionSessionResponse,
  GetInteractionStatsRequest,
  GetInteractionStatsResponse,
} from '@shared-types';

export const interactionTrackingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    flushInteractionSession: builder.mutation<
      FlushInteractionSessionResponse,
      FlushInteractionSessionRequest
    >({
      query: (data) => ({
        functionName: 'flushInteractionSession',
        data,
      }),
      invalidatesTags: ['InteractionStats'],
    }),

    getInteractionStats: builder.query<
      GetInteractionStatsResponse,
      GetInteractionStatsRequest
    >({
      query: (data) => ({
        functionName: 'getInteractionStats',
        data,
      }),
      providesTags: ['InteractionStats'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useFlushInteractionSessionMutation,
  useGetInteractionStatsQuery,
} = interactionTrackingApi;
