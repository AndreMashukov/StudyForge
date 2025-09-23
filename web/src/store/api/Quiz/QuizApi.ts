import { baseApi } from '../baseApi';
import {
  Quiz,
  GenerateQuizRequest,
  GenerateQuizResponse,
  GetQuizResponse,
  GetUserQuizzesResponse,
  ApiResponse
} from '@shared-types';

export const quizApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Generate a quiz from a document
    generateQuiz: builder.mutation<ApiResponse<GenerateQuizResponse>, GenerateQuizRequest>({
      query: (data) => ({
        functionName: 'generateQuiz',
        data,
      }),
      invalidatesTags: ['UserQuizzes', 'RecentQuizzes'],
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
  useDeleteQuizMutation,
} = quizApi;