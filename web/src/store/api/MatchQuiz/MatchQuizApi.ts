import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import { auth } from '../../../config/firebase';
import {
  fetchMatchQuizFromFirestore,
  fetchUserMatchQuizzesFromFirestore,
} from '../../../services/artifactFirestore';
import { deleteMatchQuizInFirestore } from '../../../services/artifactMutations';
import {
  authRequiredError,
  customError,
  notFoundError,
  toFirestoreDoc,
} from '../../../services/firestoreReadUtils';
import { attachArtifactDocListener } from '../utils/artifactDetailRealtime';
import { runOptimisticArtifactDirectoryRemove } from '../utils/artifactGenerationOptimistic';
import {
  ApiResponse,
  GenerateMatchQuizRequest,
  GenerateMatchQuizResponse,
  GetMatchQuizResponse,
  MatchQuiz,
} from '@shared-types';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const matchQuizApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateMatchQuiz: builder.mutation<
      ApiResponse<GenerateMatchQuizResponse>,
      GenerateMatchQuizRequest
    >({
      query: (data) => ({
        functionName: 'generateMatchQuiz',
        data,
        timeout: 300000,
      }),
      onQueryStarted: createArtifactOnQueryStarted(
        'matchQuizzes',
        'Match quiz',
        'match quiz',
        { successMessage: 'Match quiz is preparing' },
      ),
      invalidatesTags: ['UserMatchQuizzes'],
    }),

    getMatchQuiz: builder.query<
      ApiResponse<GetMatchQuizResponse>,
      { matchQuizId: string }
    >({
      async queryFn({ matchQuizId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const matchQuiz = await fetchMatchQuizFromFirestore(userId, matchQuizId);
          if (!matchQuiz) return notFoundError('Match quiz not found');
          return { data: { success: true, data: { matchQuiz } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      async onCacheEntryAdded(
        { matchQuizId },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        await attachArtifactDocListener({
          collectionName: 'matchQuizzes',
          docId: matchQuizId,
          cacheDataLoaded,
          cacheEntryRemoved,
          onMapped: (matchQuiz: MatchQuiz) => {
            updateCachedData((draft) => {
              if (!draft?.data?.matchQuiz) return;
              draft.data.matchQuiz = matchQuiz;
            });
          },
          mapSnapshot: (id, raw) => toFirestoreDoc<MatchQuiz>(id, raw),
        });
      },
      providesTags: (_result, _error, arg) => [{ type: 'MatchQuiz', id: arg.matchQuizId }],
      keepUnusedDataFor: 300,
    }),

    getUserMatchQuizzes: builder.query<
      ApiResponse<{ matchQuizzes: MatchQuiz[] }>,
      void
    >({
      async queryFn() {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const matchQuizzes = await fetchUserMatchQuizzesFromFirestore(userId);
          return { data: { success: true, data: { matchQuizzes } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: ['UserMatchQuizzes'],
      keepUnusedDataFor: 300,
    }),

    deleteMatchQuiz: builder.mutation<
      ApiResponse<{ success: boolean }>,
      { matchQuizId: string }
    >({
      async queryFn({ matchQuizId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          await deleteMatchQuizInFirestore(userId, matchQuizId);
          return { data: { success: true, data: { success: true } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: 'MatchQuiz', id: arg.matchQuizId },
        'UserMatchQuizzes',
      ],
      async onQueryStarted({ matchQuizId }, { dispatch, getState, queryFulfilled }) {
        await runOptimisticArtifactDirectoryRemove(
          dispatch,
          getState,
          queryFulfilled,
          matchQuizId,
          'matchQuiz',
        );
      },
    }),
  }),
});

export const {
  useGenerateMatchQuizMutation,
  useGetMatchQuizQuery,
  useGetUserMatchQuizzesQuery,
  useDeleteMatchQuizMutation,
} = matchQuizApi;