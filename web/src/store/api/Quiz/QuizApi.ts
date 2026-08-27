import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import { auth } from '../../../config/firebase';
import { fetchQuizFromFirestore, toQuiz } from '../../../services/quizFirestore';
import {
  fetchDocumentQuizzesFromFirestore,
  fetchUserQuizzesFromFirestore,
} from '../../../services/quizListFirestore';
import { deleteQuizInFirestore } from '../../../services/artifactMutations';
import {
  authRequiredError,
  customError,
  notFoundError,
} from '../../../services/firestoreReadUtils';
import { attachArtifactDocListener } from '../utils/artifactDetailRealtime';
import { runOptimisticArtifactDirectoryRemove } from '../utils/artifactGenerationOptimistic';
import {
  Quiz,
  GenerateQuizRequest,
  GenerateQuizResponse,
  GetQuizResponse,
  GetUserQuizzesResponse,
  GetDocumentQuizzesRequest,
  GetDocumentQuizzesResponse,
  ApiResponse,
} from '@shared-types';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const quizApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateQuiz: builder.mutation<ApiResponse<GenerateQuizResponse>, GenerateQuizRequest>({
      query: (data) => ({
        functionName: 'generateQuiz',
        data,
      }),
      onQueryStarted: createArtifactOnQueryStarted('quizzes', 'Quiz', 'quiz', {
        successMessage: 'Quiz is preparing',
      }),
      invalidatesTags: (_result, _error, arg) => [
        'UserQuizzes',
        ...arg.documentIds.map((id) => ({ type: 'DocumentQuizzes' as const, id })),
      ],
    }),

    getQuiz: builder.query<ApiResponse<GetQuizResponse>, { quizId: string }>({
      async queryFn({ quizId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        if (!quizId.trim()) return customError('Quiz ID is required');

        try {
          const quiz = await fetchQuizFromFirestore(userId, quizId);
          if (!quiz) return notFoundError('Quiz not found');
          return { data: { success: true, data: { quiz } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      async onCacheEntryAdded({ quizId }, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        await attachArtifactDocListener({
          collectionName: 'quizzes',
          docId: quizId,
          cacheDataLoaded,
          cacheEntryRemoved,
          onMapped: (quiz: Quiz) => {
            updateCachedData((draft) => {
              if (!draft?.data?.quiz) return;
              draft.data.quiz = quiz;
            });
          },
          mapSnapshot: (id, raw) => toQuiz(id, raw),
        });
      },
      providesTags: (_result, _error, arg) => [{ type: 'Quiz', id: arg.quizId }],
      keepUnusedDataFor: 300,
    }),

    getUserQuizzes: builder.query<ApiResponse<GetUserQuizzesResponse>, void>({
      async queryFn() {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const quizzes = await fetchUserQuizzesFromFirestore(userId);
          return { data: { success: true, data: { quizzes } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: ['UserQuizzes'],
      keepUnusedDataFor: 300,
    }),

    getDocumentQuizzes: builder.query<
      ApiResponse<GetDocumentQuizzesResponse>,
      GetDocumentQuizzesRequest
    >({
      async queryFn({ documentId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        if (!documentId.trim()) return customError('Document ID is required');

        try {
          const quizzes = await fetchDocumentQuizzesFromFirestore(userId, documentId);
          return { data: { success: true, data: { quizzes } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: 'DocumentQuizzes', id: arg.documentId },
        'UserQuizzes',
      ],
      keepUnusedDataFor: 300,
    }),

    deleteQuiz: builder.mutation<ApiResponse<{ success: boolean }>, { quizId: string }>({
      async queryFn({ quizId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          await deleteQuizInFirestore(userId, quizId);
          return { data: { success: true, data: { success: true } } };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Quiz', id: arg.quizId },
        'UserQuizzes',
      ],
      async onQueryStarted({ quizId }, { dispatch, getState, queryFulfilled }) {
        await runOptimisticArtifactDirectoryRemove(
          dispatch,
          getState,
          queryFulfilled,
          quizId,
          'quiz',
        );
      },
    }),
  }),
});

export const {
  useGenerateQuizMutation,
  useGetQuizQuery,
  useGetUserQuizzesQuery,
  useGetDocumentQuizzesQuery,
  useDeleteQuizMutation,
} = quizApi;
