import { baseApi } from '../baseApi';
import {
  ApiResponse,
  GenerateSequenceQuizRequest,
  GenerateSequenceQuizResponse,
  GetSequenceQuizResponse,
} from '@shared-types';

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
      invalidatesTags: (result, error, arg) => [
        'UserSequenceQuizzes',
        { type: 'Directory', id: 'CONTENTS' },
        ...(arg.directoryId
          ? ([{ type: 'Directory' as const, id: arg.directoryId }] as const)
          : []),
      ],
    }),

    getSequenceQuiz: builder.query<
      ApiResponse<GetSequenceQuizResponse>,
      { sequenceQuizId: string }
    >({
      query: (data) => ({
        functionName: 'getSequenceQuiz',
        data,
      }),
      providesTags: (result, error, arg) => [
        { type: 'SequenceQuiz', id: arg.sequenceQuizId },
      ],
    }),

    getUserSequenceQuizzes: builder.query<ApiResponse<{ sequenceQuizzes: unknown[] }>, void>({
      query: () => ({
        functionName: 'getUserSequenceQuizzes',
        data: {},
      }),
      providesTags: ['UserSequenceQuizzes'],
    }),

    deleteSequenceQuiz: builder.mutation<
      ApiResponse<{ success: boolean }>,
      { sequenceQuizId: string }
    >({
      query: (data) => ({
        functionName: 'deleteSequenceQuiz',
        data,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'SequenceQuiz', id: arg.sequenceQuizId },
        'UserSequenceQuizzes',
        { type: 'Directory', id: 'CONTENTS' },
      ],
    }),
  }),
});

export const {
  useGenerateSequenceQuizMutation,
  useGetSequenceQuizQuery,
  useGetUserSequenceQuizzesQuery,
  useDeleteSequenceQuizMutation,
} = sequenceQuizApi;
