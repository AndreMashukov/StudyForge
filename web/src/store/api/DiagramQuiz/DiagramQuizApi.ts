import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import { auth } from '../../../config/firebase';
import {
  fetchDiagramQuizFromFirestore,
  fetchUserDiagramQuizzesFromFirestore,
} from '../../../services/artifactFirestore';
import { deleteDiagramQuizInFirestore } from '../../../services/artifactMutations';
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
  DiagramQuiz,
  GenerateDiagramQuizRequest,
  GenerateDiagramQuizResponse,
  GetDiagramQuizResponse,
} from '@shared-types';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const diagramQuizApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateDiagramQuiz: builder.mutation<
      ApiResponse<GenerateDiagramQuizResponse>,
      GenerateDiagramQuizRequest
    >({
      query: (data) => ({
        functionName: 'generateDiagramQuiz',
        data,
        timeout: 60000,
      }),
      onQueryStarted: createArtifactOnQueryStarted(
        'diagramQuizzes',
        'Diagram quiz',
        'diagram quiz',
        {
          successMessage: 'Diagram quiz generation started — it will appear when ready',
        },
      ),
      invalidatesTags: ['UserDiagramQuizzes'],
    }),

    getDiagramQuiz: builder.query<
      ApiResponse<GetDiagramQuizResponse>,
      { diagramQuizId: string }
    >({
      async queryFn({ diagramQuizId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const diagramQuiz = await fetchDiagramQuizFromFirestore(userId, diagramQuizId);
          if (!diagramQuiz) return notFoundError('Diagram quiz not found');
          return { data: { success: true, data: { diagramQuiz } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      async onCacheEntryAdded(
        { diagramQuizId },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        await attachArtifactDocListener({
          collectionName: 'diagramQuizzes',
          docId: diagramQuizId,
          cacheDataLoaded,
          cacheEntryRemoved,
          onMapped: (diagramQuiz: DiagramQuiz) => {
            updateCachedData((draft) => {
              if (!draft?.data?.diagramQuiz) return;
              draft.data.diagramQuiz = diagramQuiz;
            });
          },
          mapSnapshot: (id, raw) => toFirestoreDoc<DiagramQuiz>(id, raw),
        });
      },
      providesTags: (_result, _error, arg) => [{ type: 'DiagramQuiz', id: arg.diagramQuizId }],
      keepUnusedDataFor: 300,
    }),

    getUserDiagramQuizzes: builder.query<ApiResponse<{ diagramQuizzes: DiagramQuiz[] }>, void>({
      async queryFn() {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const diagramQuizzes = await fetchUserDiagramQuizzesFromFirestore(userId);
          return { data: { success: true, data: { diagramQuizzes } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: ['UserDiagramQuizzes'],
      keepUnusedDataFor: 300,
    }),

    deleteDiagramQuiz: builder.mutation<
      ApiResponse<{ success: boolean }>,
      { diagramQuizId: string }
    >({
      async queryFn({ diagramQuizId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          await deleteDiagramQuizInFirestore(userId, diagramQuizId);
          return { data: { success: true, data: { success: true } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: 'DiagramQuiz', id: arg.diagramQuizId },
        'UserDiagramQuizzes',
      ],
      async onQueryStarted({ diagramQuizId }, { dispatch, getState, queryFulfilled }) {
        await runOptimisticArtifactDirectoryRemove(
          dispatch,
          getState,
          queryFulfilled,
          diagramQuizId,
          'diagramQuiz',
        );
      },
    }),
  }),
});

export const {
  useGenerateDiagramQuizMutation,
  useGetDiagramQuizQuery,
  useGetUserDiagramQuizzesQuery,
  useDeleteDiagramQuizMutation,
} = diagramQuizApi;
