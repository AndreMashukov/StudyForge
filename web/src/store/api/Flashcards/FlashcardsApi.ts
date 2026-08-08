import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import { auth } from '../../../config/firebase';
import {
  fetchFlashcardSetFromFirestore,
  fetchUserFlashcardSetsFromFirestore,
} from '../../../services/artifactFirestore';
import { toFirestoreDoc } from '../../../services/firestoreReadUtils';
import { attachArtifactDocListener } from '../utils/artifactDetailRealtime';
import {
  FlashcardSet,
  GenerateFlashcardsRequest,
  GenerateFlashcardsResponse,
  RecordLearnedVocabularyRequest,
  RecordLearnedVocabularyResponse,
  UpdateFlashcardSetRequest,
  ApiResponse
} from '@shared-types';

export const flashcardsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateFlashcards: builder.mutation<ApiResponse<GenerateFlashcardsResponse>, GenerateFlashcardsRequest>({
      query: (data) => ({
        functionName: 'generateFlashcards',
        data,
      }),
      onQueryStarted: createArtifactOnQueryStarted('cards', 'Flashcards', 'flashcards', {
        successMessage: 'Flashcards are preparing',
      }),
      invalidatesTags: (result, error, arg) => [
        'UserFlashcardSets',
        ...(arg.directoryId
          ? [{ type: 'Directory' as const, id: arg.directoryId }]
          : []),
      ],
    }),

    getFlashcardSet: builder.query<ApiResponse<FlashcardSet>, { flashcardSetId: string }>({
      async queryFn({ flashcardSetId }, _api, _extraOptions, baseQuery) {
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
          const flashcardSet = await fetchFlashcardSetFromFirestore(userId, flashcardSetId);
          if (!flashcardSet) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                data: { message: 'Flashcard set not found', code: 'NOT_FOUND' },
              },
            };
          }

          return { data: { success: true, data: flashcardSet } };
        } catch (firestoreError) {
          console.warn('Firestore flashcard set read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getFlashcardSet',
            data: { flashcardSetId },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as ApiResponse<FlashcardSet> };
        }
      },
      async onCacheEntryAdded({ flashcardSetId }, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        await attachArtifactDocListener({
          collectionName: 'flashcardSets',
          docId: flashcardSetId,
          cacheDataLoaded,
          cacheEntryRemoved,
          onMapped: (flashcardSet: FlashcardSet) => {
            updateCachedData((draft) => {
              if (!draft?.data) {
                return;
              }
              draft.data = flashcardSet;
            });
          },
          mapSnapshot: (id, raw) => toFirestoreDoc<FlashcardSet>(id, raw),
        });
      },
      providesTags: (result, error, arg) => [{ type: 'FlashcardSet', id: arg.flashcardSetId }],
      keepUnusedDataFor: 300,
    }),

    getUserFlashcardSets: builder.query<ApiResponse<FlashcardSet[]>, void>({
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
          const flashcardSets = await fetchUserFlashcardSetsFromFirestore(userId);
          return { data: { success: true, data: flashcardSets } };
        } catch (firestoreError) {
          console.warn('Firestore flashcard list read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getUserFlashcardSets',
            data: {},
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as ApiResponse<FlashcardSet[]> };
        }
      },
      providesTags: ['UserFlashcardSets'],
      keepUnusedDataFor: 300,
    }),

    updateFlashcardSet: builder.mutation<ApiResponse<{ success: boolean }>, UpdateFlashcardSetRequest>({
      query: (data) => ({
        functionName: 'updateFlashcardSet',
        data,
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'FlashcardSet', id: arg.flashcardSetId }],
    }),

    deleteFlashcardSet: builder.mutation<ApiResponse<{ success: boolean }>, { flashcardSetId: string }>({
      query: (data) => ({
        functionName: 'deleteFlashcardSet',
        data,
      }),
      invalidatesTags: ['UserFlashcardSets'],
    }),

    recordLearnedVocabulary: builder.mutation<
      ApiResponse<RecordLearnedVocabularyResponse>,
      RecordLearnedVocabularyRequest
    >({
      query: (data) => ({
        functionName: 'recordLearnedVocabulary',
        data,
      }),
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
