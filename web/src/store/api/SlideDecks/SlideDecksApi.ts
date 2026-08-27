import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import { auth } from '../../../config/firebase';
import {
  fetchSlideDeckFromFirestore,
  fetchUserSlideDecksFromFirestore,
} from '../../../services/artifactFirestore';
import { deleteSlideDeckInFirestore } from '../../../services/artifactMutations';
import {
  authRequiredError,
  customError,
  notFoundError,
  toFirestoreDoc,
} from '../../../services/firestoreReadUtils';
import { attachArtifactDocListener } from '../utils/artifactDetailRealtime';
import { runOptimisticArtifactDirectoryRemove } from '../utils/artifactGenerationOptimistic';
import {
  SlideDeck,
  GenerateSlideDeckRequest,
  GenerateSlideDeckResponse,
  ApiResponse,
} from '@shared-types';
import { resolveSlideDeckImageUrls } from '../../../utils/slideImageUtils';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const slideDecksApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateSlideDeck: builder.mutation<
      ApiResponse<GenerateSlideDeckResponse>,
      GenerateSlideDeckRequest
    >({
      query: (data) => ({
        functionName: 'generateSlideDeck',
        data,
        timeout: 310_000,
      }),
      onQueryStarted: createArtifactOnQueryStarted('slides', 'Slide deck', 'slide deck', {
        successMessage: 'Slide deck is preparing',
      }),
      invalidatesTags: ['UserSlideDecks'],
    }),

    getSlideDeck: builder.query<ApiResponse<SlideDeck>, { slideDeckId: string }>({
      async queryFn({ slideDeckId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const slideDeck = await fetchSlideDeckFromFirestore(userId, slideDeckId);
          if (!slideDeck) return notFoundError('Slide deck not found');
          return { data: { success: true, data: resolveSlideDeckImageUrls(slideDeck) } };
        } catch (error) {
          return mutationError(error);
        }
      },
      async onCacheEntryAdded(
        { slideDeckId },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        await attachArtifactDocListener({
          collectionName: 'slideDecks',
          docId: slideDeckId,
          cacheDataLoaded,
          cacheEntryRemoved,
          onMapped: (slideDeck: SlideDeck) => {
            updateCachedData((draft) => {
              if (!draft?.data) return;
              draft.data = resolveSlideDeckImageUrls(slideDeck);
            });
          },
          mapSnapshot: (id, raw) =>
            resolveSlideDeckImageUrls(toFirestoreDoc<SlideDeck>(id, raw)),
        });
      },
      providesTags: (_result, _error, arg) => [{ type: 'SlideDeck', id: arg.slideDeckId }],
      keepUnusedDataFor: 300,
    }),

    getUserSlideDecks: builder.query<ApiResponse<SlideDeck[]>, void>({
      async queryFn() {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const slideDecks = await fetchUserSlideDecksFromFirestore(userId);
          return { data: { success: true, data: slideDecks } };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: ['UserSlideDecks'],
      keepUnusedDataFor: 300,
    }),

    deleteSlideDeck: builder.mutation<
      ApiResponse<{ success: boolean }>,
      { slideDeckId: string }
    >({
      async queryFn({ slideDeckId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          await deleteSlideDeckInFirestore(userId, slideDeckId);
          return { data: { success: true, data: { success: true } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        'UserSlideDecks',
        { type: 'SlideDeck', id: arg.slideDeckId },
      ],
      async onQueryStarted({ slideDeckId }, { dispatch, getState, queryFulfilled }) {
        await runOptimisticArtifactDirectoryRemove(
          dispatch,
          getState,
          queryFulfilled,
          slideDeckId,
          'slideDeck',
        );
      },
    }),
  }),
});

export const {
  useGenerateSlideDeckMutation,
  useGetSlideDeckQuery,
  useGetUserSlideDecksQuery,
  useDeleteSlideDeckMutation,
} = slideDecksApi;
