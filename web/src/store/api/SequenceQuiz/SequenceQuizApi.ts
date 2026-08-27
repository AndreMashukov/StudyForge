import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import { auth } from '../../../config/firebase';
import {
  fetchSequenceQuizFromFirestore,
  fetchUserSequenceQuizzesFromFirestore,
} from '../../../services/artifactFirestore';
import { deleteSequenceQuizInFirestore } from '../../../services/artifactMutations';
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
  GenerateSequenceQuizRequest,
  GenerateSequenceQuizResponse,
  GetSequenceQuizResponse,
  SequenceQuiz,
} from '@shared-types';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const sequenceQuizApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateSequenceQuiz: builder.mutation<
      ApiResponse<GenerateSequenceQuizResponse>,
      GenerateSequenceQuizRequest
    >({
      query: (data) => ({
        functionName: 'generateSequenceQuiz',
        data,
        timeout: 300000,
      }),
      onQueryStarted: createArtifactOnQueryStarted(
        'sequenceQuizzes',
        'Sequence quiz',
        'sequence quiz',
        { successMessage: 'Sequence quiz is preparing' },
      ),
      invalidatesTags: ['UserSequenceQuizzes'],
    }),

    getSequenceQuiz: builder.query<
      ApiResponse<GetSequenceQuizResponse>,
      { sequenceQuizId: string }
    >({
      async queryFn({ sequenceQuizId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const sequenceQuiz = await fetchSequenceQuizFromFirestore(userId, sequenceQuizId);
          if (!sequenceQuiz) return notFoundError('Sequence quiz not found');
          return { data: { success: true, data: { sequenceQuiz } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      async onCacheEntryAdded(
        { sequenceQuizId },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        await attachArtifactDocListener({
          collectionName: 'sequenceQuizzes',
          docId: sequenceQuizId,
          cacheDataLoaded,
          cacheEntryRemoved,
          onMapped: (sequenceQuiz: SequenceQuiz) => {
            updateCachedData((draft) => {
              if (!draft?.data?.sequenceQuiz) return;
              draft.data.sequenceQuiz = sequenceQuiz;
            });
          },
          mapSnapshot: (id, raw) => toFirestoreDoc<SequenceQuiz>(id, raw),
        });
      },
      providesTags: (_result, _error, arg) => [{ type: 'SequenceQuiz', id: arg.sequenceQuizId }],
      keepUnusedDataFor: 300,
    }),

    getUserSequenceQuizzes: builder.query<
      ApiResponse<{ sequenceQuizzes: SequenceQuiz[] }>,
      void
    >({
      async queryFn() {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const sequenceQuizzes = await fetchUserSequenceQuizzesFromFirestore(userId);
          return { data: { success: true, data: { sequenceQuizzes } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: ['UserSequenceQuizzes'],
      keepUnusedDataFor: 300,
    }),

    deleteSequenceQuiz: builder.mutation<
      ApiResponse<{ success: boolean }>,
      { sequenceQuizId: string }
    >({
      async queryFn({ sequenceQuizId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          await deleteSequenceQuizInFirestore(userId, sequenceQuizId);
          return { data: { success: true, data: { success: true } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: 'SequenceQuiz', id: arg.sequenceQuizId },
        'UserSequenceQuizzes',
      ],
      async onQueryStarted({ sequenceQuizId }, { dispatch, getState, queryFulfilled }) {
        await runOptimisticArtifactDirectoryRemove(
          dispatch,
          getState,
          queryFulfilled,
          sequenceQuizId,
          'sequenceQuiz',
        );
      },
    }),
  }),
});

export const {
  useGenerateSequenceQuizMutation,
  useGetSequenceQuizQuery,
  useGetUserSequenceQuizzesQuery,
  useDeleteSequenceQuizMutation,
} = sequenceQuizApi;
