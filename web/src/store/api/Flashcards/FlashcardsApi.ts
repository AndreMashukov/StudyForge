import { baseApi } from '../baseApi';
import {
  FlashcardSet,
  GenerateFlashcardsRequest,
  GenerateFlashcardsResponse,
  UpdateFlashcardSetRequest,
  ApiResponse
} from '@shared-types';

export const flashcardsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Generate a flashcard set from a document
    generateFlashcards: builder.mutation<ApiResponse<GenerateFlashcardsResponse>, GenerateFlashcardsRequest>({
      query: (data) => ({
        functionName: 'generateFlashcards',
        data,
      }),
      invalidatesTags: (result, error, arg) => [
        'UserFlashcardSets',
        { type: 'Directory', id: 'CONTENTS' },
        ...(arg.directoryId
          ? [{ type: 'Directory' as const, id: arg.directoryId }]
          : []),
      ],
    }),

    // Get a specific flashcard set by ID
    getFlashcardSet: builder.query<ApiResponse<FlashcardSet>, { flashcardSetId: string }>({
      query: (data) => ({
        functionName: 'getFlashcardSet',
        data,
      }),
      providesTags: (result, error, arg) => [{ type: 'FlashcardSet', id: arg.flashcardSetId }],
    }),

    // Get all of the user's flashcard sets
    getUserFlashcardSets: builder.query<ApiResponse<FlashcardSet[]>, void>({
      query: () => ({
        functionName: 'getUserFlashcardSets',
        data: {},
      }),
      providesTags: ['UserFlashcardSets'],
    }),

    // Update a flashcard set
    updateFlashcardSet: builder.mutation<ApiResponse<{ success: boolean }>, UpdateFlashcardSetRequest>({
      query: (data) => ({
        functionName: 'updateFlashcardSet',
        data,
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'FlashcardSet', id: arg.flashcardSetId }],
    }),

    // Delete a flashcard set
    deleteFlashcardSet: builder.mutation<ApiResponse<{ success: boolean }>, { flashcardSetId: string }>({
      query: (data) => ({
        functionName: 'deleteFlashcardSet',
        data,
      }),
      invalidatesTags: ['UserFlashcardSets'],
    }),
  }),
});

export const {
  useGenerateFlashcardsMutation,
  useGetFlashcardSetQuery,
  useGetUserFlashcardSetsQuery,
  useUpdateFlashcardSetMutation,
  useDeleteFlashcardSetMutation,
} = flashcardsApi;
