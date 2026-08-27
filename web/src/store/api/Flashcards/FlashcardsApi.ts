import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import { auth } from '../../../config/firebase';
import {
  fetchFlashcardSetFromFirestore,
  fetchUserFlashcardSetsFromFirestore,
} from '../../../services/artifactFirestore';
import {
  deleteFlashcardSetInFirestore,
  updateFlashcardSetInFirestore,
  recordLearnedVocabularyInFirestore,
} from '../../../services/artifactMutations';
import {
  authRequiredError,
  customError,
  notFoundError,
  toFirestoreDoc,
} from '../../../services/firestoreReadUtils';
import { attachArtifactDocListener } from '../utils/artifactDetailRealtime';
import { runOptimisticArtifactDirectoryRemove } from '../utils/artifactGenerationOptimistic';
import {
  FlashcardSet,
  GenerateFlashcardsRequest,
  GenerateFlashcardsResponse,
  RecordLearnedVocabularyRequest,
  RecordLearnedVocabularyResponse,
  UpdateFlashcardSetRequest,
  ApiResponse,
} from '@shared-types';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const flashcardsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateFlashcards: builder.mutation<
      ApiResponse<GenerateFlashcardsResponse>,
      GenerateFlashcardsRequest
    >({
      query: (data) => ({
        functionName: 'generateFlashcards',
        data,
      }),
      onQueryStarted: createArtifactOnQueryStarted('cards', 'Flashcards', 'flashcards', {
        successMessage: 'Flashcards are preparing',
      }),
      invalidatesTags: ['UserFlashcardSets'],
    }),

    getFlashcardSet: builder.query<ApiResponse<FlashcardSet>, { flashcardSetId: string }>({
      async queryFn({ flashcardSetId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const flashcardSet = await fetchFlashcardSetFromFirestore(userId, flashcardSetId);
          if (!flashcardSet) return notFoundError('Flashcard set not found');
          return { data: { success: true, data: flashcardSet } };
        } catch (error) {
          return mutationError(error);
        }
      },
      async onCacheEntryAdded(
        { flashcardSetId },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        await attachArtifactDocListener({
          collectionName: 'flashcardSets',
          docId: flashcardSetId,
          cacheDataLoaded,
          cacheEntryRemoved,
          onMapped: (flashcardSet: FlashcardSet) => {
            updateCachedData((draft) => {
              if (!draft?.data) return;
              draft.data = flashcardSet;
            });
          },
          mapSnapshot: (id, raw) => toFirestoreDoc<FlashcardSet>(id, raw),
        });
      },
      providesTags: (_result, _error, arg) => [{ type: 'FlashcardSet', id: arg.flashcardSetId }],
      keepUnusedDataFor: 300,
    }),

    getUserFlashcardSets: builder.query<ApiResponse<FlashcardSet[]>, void>({
      async queryFn() {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const flashcardSets = await fetchUserFlashcardSetsFromFirestore(userId);
          return { data: { success: true, data: flashcardSets } };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: ['UserFlashcardSets'],
      keepUnusedDataFor: 300,
    }),

    updateFlashcardSet: builder.mutation<
      ApiResponse<{ success: boolean }>,
      UpdateFlashcardSetRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          await updateFlashcardSetInFirestore(userId, data);
          return { data: { success: true, data: { success: true } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (_result, _error, arg) => [{ type: 'FlashcardSet', id: arg.flashcardSetId }],
    }),

    deleteFlashcardSet: builder.mutation<
      ApiResponse<{ success: boolean }>,
      { flashcardSetId: string }
    >({
      async queryFn({ flashcardSetId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          await deleteFlashcardSetInFirestore(userId, flashcardSetId);
          return { data: { success: true, data: { success: true } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: ['UserFlashcardSets'],
      async onQueryStarted({ flashcardSetId }, { dispatch, getState, queryFulfilled }) {
        await runOptimisticArtifactDirectoryRemove(
          dispatch,
          getState,
          queryFulfilled,
          flashcardSetId,
          'flashcard',
        );
      },
    }),

    recordLearnedVocabulary: builder.mutation<
      ApiResponse<RecordLearnedVocabularyResponse>,
      RecordLearnedVocabularyRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await recordLearnedVocabularyInFirestore({
            userId,
            flashcardSetId: data.flashcardSetId,
            flashcardId: data.flashcardId,
            term: data.term,
          });
          return {
            data: {
              success: true,
              data: {
                learnedVocabularyId: result.id,
                created: result.created,
              },
            },
          };
        } catch (error) {
          return mutationError(error);
        }
      },
    }),
  }),
});

export const {
  useGenerateFlashcardsMutation,
  useGetFlashcardSetQuery,
  useGetUserFlashcardSetsQuery,
  useUpdateFlashcardSetMutation,
  useDeleteFlashcardSetMutation,
  useRecordLearnedVocabularyMutation,
} = flashcardsApi;
