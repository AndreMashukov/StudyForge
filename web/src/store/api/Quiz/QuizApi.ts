import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import { auth } from '../../../config/firebase';
import { fetchQuizFromFirestore, toQuiz } from '../../../services/quizFirestore';
import {
  fetchDocumentQuizzesFromFirestore,
  fetchUserQuizzesFromFirestore,
} from '../../../services/quizListFirestore';
import { attachArtifactDocListener } from '../utils/artifactDetailRealtime';
import {
  Quiz,
  GenerateQuizRequest,
  GenerateQuizResponse,
  GetQuizResponse,
  GetUserQuizzesResponse,
  GetDocumentQuizzesRequest,
  GetDocumentQuizzesResponse,
  ApiResponse
} from '@shared-types';

export const quizApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Generate a quiz from one or more documents
    generateQuiz: builder.mutation<ApiResponse<GenerateQuizResponse>, GenerateQuizRequest>({
      query: (data) => ({
        functionName: 'generateQuiz',
        data,
      }),
      onQueryStarted: createArtifactOnQueryStarted('quizzes', 'Quiz', 'quiz', {
        successMessage: 'Quiz is preparing',
      }),
      invalidatesTags: (result, error, arg) => [
        'UserQuizzes',
        'RecentQuizzes',
        { type: 'Directory', id: 'CONTENTS' },
        ...(arg.directoryId
          ? ([{ type: 'Directory' as const, id: arg.directoryId }] as const)
          : []),
        ...arg.documentIds.map((id) => ({ type: 'DocumentQuizzes' as const, id })),
      ],
    }),

    // Get a specific quiz — Firestore-native read with IndexedDB cache; callable fallback on failure.
    getQuiz: builder.query<ApiResponse<GetQuizResponse>, { quizId: string }>({
      async queryFn({ quizId }, _api, _extraOptions, baseQuery) {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Authentication required' },
            },
          };
        }

        if (!quizId.trim()) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Quiz ID is required' },
            },
          };
        }

        try {
          const quiz = await fetchQuizFromFirestore(userId, quizId);
          if (!quiz) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                data: { message: 'Quiz not found', code: 'NOT_FOUND' },
              },
            };
          }

          return {
            data: {
              success: true,
              data: { quiz },
            },
          };
        } catch (firestoreError) {
          console.warn('Firestore quiz read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getQuiz',
            data: { quizId },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as ApiResponse<GetQuizResponse> };
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
              if (!draft?.data?.quiz) {
                return;
              }
              draft.data.quiz = quiz;
            });
          },
          mapSnapshot: (id, raw) => toQuiz(id, raw),
        });
      },
      providesTags: (result, error, arg) => [{ type: 'Quiz', id: arg.quizId }],
      keepUnusedDataFor: 300,
    }),

    // Get user's quiz history (requires authentication)
    getUserQuizzes: builder.query<ApiResponse<GetUserQuizzesResponse>, void>({
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
          const quizzes = await fetchUserQuizzesFromFirestore(userId);
          return { data: { success: true, data: { quizzes } } };
        } catch (firestoreError) {
          console.warn('Firestore user quizzes read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getUserQuizzes',
            data: {},
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as ApiResponse<GetUserQuizzesResponse> };
        }
      },
      providesTags: ['UserQuizzes'],
      keepUnusedDataFor: 300,
    }),

    // Get recent public quizzes
    getRecentQuizzes: builder.query<ApiResponse<{ quizzes: Quiz[] }>, void>({
      query: () => ({
        functionName: 'getRecentQuizzes',
        data: {},
      }),
      providesTags: ['RecentQuizzes'],
    }),

    // Get all quizzes for a specific document
    getDocumentQuizzes: builder.query<ApiResponse<GetDocumentQuizzesResponse>, GetDocumentQuizzesRequest>({
      async queryFn({ documentId }, _api, _extraOptions, baseQuery) {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Authentication required' },
            },
          };
        }

        if (!documentId.trim()) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Document ID is required' },
            },
          };
        }

        try {
          const quizzes = await fetchDocumentQuizzesFromFirestore(userId, documentId);
          return { data: { success: true, data: { quizzes } } };
        } catch (firestoreError) {
          console.warn('Firestore document quizzes read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getDocumentQuizzes',
            data: { documentId },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as ApiResponse<GetDocumentQuizzesResponse> };
        }
      },
      providesTags: (result, error, arg) => [
        { type: 'DocumentQuizzes', id: arg.documentId },
        'UserQuizzes',
      ],
      keepUnusedDataFor: 300,
    }),

    // Delete a quiz (if we implement this later)
    deleteQuiz: builder.mutation<ApiResponse<{ success: boolean }>, { quizId: string }>({
      query: (data) => ({
        functionName: 'deleteQuiz',
        data,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Quiz', id: arg.quizId },
        'UserQuizzes',
      ],
    }),
  }),
});

export const {
  useGenerateQuizMutation,
  useGetQuizQuery,
  useGetUserQuizzesQuery,
  useGetRecentQuizzesQuery,
  useGetDocumentQuizzesQuery,
  useDeleteQuizMutation,
} = quizApi;