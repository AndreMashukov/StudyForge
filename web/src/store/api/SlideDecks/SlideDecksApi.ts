import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import { auth } from '../../../config/firebase';
import {
  fetchSlideDeckFromFirestore,
  fetchUserSlideDecksFromFirestore,
} from '../../../services/artifactFirestore';
import { toFirestoreDoc } from '../../../services/firestoreReadUtils';
import { attachArtifactDocListener } from '../utils/artifactDetailRealtime';
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
        timeout: 310_000,
      }),
      onQueryStarted: createArtifactOnQueryStarted('slides', 'Slide deck', 'slide deck', {
        successMessage: 'Slide deck is preparing',
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
      async queryFn({ slideDeckId }, _api, _extraOptions, baseQuery) {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Authentication required' },
            },
          };
        }

        try {
          const slideDeck = await fetchSlideDeckFromFirestore(userId, slideDeckId);
          if (!slideDeck) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                data: { message: 'Slide deck not found', code: 'NOT_FOUND' },
              },
            };
          }

          return { data: { success: true, data: slideDeck } };
        } catch (firestoreError) {
          console.warn('Firestore slide deck read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getSlideDeck',
            data: { slideDeckId },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as ApiResponse<SlideDeck> };
        }
      },
      async onCacheEntryAdded({ slideDeckId }, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        await attachArtifactDocListener({
          collectionName: 'slideDecks',
          docId: slideDeckId,
          cacheDataLoaded,
          cacheEntryRemoved,
          onMapped: (slideDeck: SlideDeck) => {
            updateCachedData((draft) => {
              if (!draft?.data) {
                return;
              }
              draft.data = slideDeck;
            });
          },
          mapSnapshot: (id, raw) => toFirestoreDoc<SlideDeck>(id, raw),
        });
      },
      providesTags: (result, error, arg) => [{ type: 'SlideDeck', id: arg.slideDeckId }],
      keepUnusedDataFor: 300,
    }),

    getUserSlideDecks: builder.query<ApiResponse<SlideDeck[]>, void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Authentication required' },
            },
          };
        }

        try {
          const slideDecks = await fetchUserSlideDecksFromFirestore(userId);
          return { data: { success: true, data: slideDecks } };
        } catch (firestoreError) {
          console.warn('Firestore slide deck list read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getUserSlideDecks',
            data: {},
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as ApiResponse<SlideDeck[]> };
        }
      },
      providesTags: ['UserSlideDecks'],
      keepUnusedDataFor: 300,
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
