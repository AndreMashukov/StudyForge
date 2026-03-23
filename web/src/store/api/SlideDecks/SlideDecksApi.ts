import { baseApi } from '../baseApi';
import {
  SlideDeck,
  GenerateSlideDeckRequest,
  GenerateSlideDeckResponse,
  ApiResponse
} from '@shared-types';

export const slideDecksApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateSlideDeck: builder.mutation<ApiResponse<GenerateSlideDeckResponse>, GenerateSlideDeckRequest>({
      query: (data) => ({
        functionName: 'generateSlideDeck',
        data,
        timeout: 310_000, // 310s — matches the server-side 300s timeout + buffer
      }),
      invalidatesTags: (result, error, arg) => [
        'UserSlideDecks',
        { type: 'Directory', id: 'CONTENTS' },
        ...(arg.directoryId
          ? [{ type: 'Directory' as const, id: arg.directoryId }]
          : []),
      ],
    }),

    getSlideDeck: builder.query<ApiResponse<SlideDeck>, { slideDeckId: string }>({
      query: (data) => ({
        functionName: 'getSlideDeck',
        data,
      }),
      providesTags: (result, error, arg) => [{ type: 'SlideDeck', id: arg.slideDeckId }],
    }),

    getUserSlideDecks: builder.query<ApiResponse<SlideDeck[]>, void>({
      query: () => ({
        functionName: 'getUserSlideDecks',
        data: {},
      }),
      providesTags: ['UserSlideDecks'],
    }),

    deleteSlideDeck: builder.mutation<ApiResponse<{ success: boolean }>, { slideDeckId: string }>({
      query: (data) => ({
        functionName: 'deleteSlideDeck',
        data,
      }),
      invalidatesTags: (result, error, arg) => [
        'UserSlideDecks',
        { type: 'SlideDeck', id: arg.slideDeckId },
      ],
    }),
  }),
});

export const {
  useGenerateSlideDeckMutation,
  useGetSlideDeckQuery,
  useGetUserSlideDecksQuery,
  useDeleteSlideDeckMutation,
} = slideDecksApi;
