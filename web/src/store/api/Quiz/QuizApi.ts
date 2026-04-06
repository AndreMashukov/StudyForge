import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
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
      onQueryStarted: createArtifactOnQueryStarted('quizzes', 'Quiz', 'quiz'),
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

    // Get a specific quiz by ID
    getQuiz: builder.query<ApiResponse<GetQuizResponse>, { quizId: string }>({
      query: (data) => ({
        functionName: 'getQuiz',
        data,
      }),
      providesTags: (result, error, arg) => [{ type: 'Quiz', id: arg.quizId }],
    }),

    // Get user's quiz history (requires authentication)
    getUserQuizzes: builder.query<ApiResponse<GetUserQuizzesResponse>, void>({
      query: () => ({
        functionName: 'getUserQuizzes',
        data: {},
      }),
      providesTags: ['UserQuizzes'],
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
      query: (data) => ({
        functionName: 'getDocumentQuizzes',
        data,
      }),
      providesTags: (result, error, arg) => [
        { type: 'DocumentQuizzes', id: arg.documentId },
        'UserQuizzes',
      ],
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