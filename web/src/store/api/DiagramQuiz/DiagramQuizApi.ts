import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import {
  ApiResponse,
  GenerateDiagramQuizRequest,
  GenerateDiagramQuizResponse,
  GetDiagramQuizResponse,
} from '@shared-types';

export const diagramQuizApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateDiagramQuiz: builder.mutation<
      ApiResponse<GenerateDiagramQuizResponse>,
      GenerateDiagramQuizRequest
    >({
      query: (data) => ({
        functionName: 'generateDiagramQuiz',
        data,
        timeout: 300000,
      }),
      onQueryStarted: createArtifactOnQueryStarted('diagramQuizzes', 'Diagram quiz', 'diagram quiz'),
      invalidatesTags: (result, error, arg) => [
        'UserDiagramQuizzes',
        { type: 'Directory', id: 'CONTENTS' },
        ...(arg.directoryId
          ? ([{ type: 'Directory' as const, id: arg.directoryId }] as const)
          : []),
      ],
    }),

    getDiagramQuiz: builder.query<
      ApiResponse<GetDiagramQuizResponse>,
      { diagramQuizId: string }
    >({
      query: (data) => ({
        functionName: 'getDiagramQuiz',
        data,
      }),
      providesTags: (result, error, arg) => [
        { type: 'DiagramQuiz', id: arg.diagramQuizId },
      ],
    }),

    getUserDiagramQuizzes: builder.query<ApiResponse<{ diagramQuizzes: unknown[] }>, void>({
      query: () => ({
        functionName: 'getUserDiagramQuizzes',
        data: {},
      }),
      providesTags: ['UserDiagramQuizzes'],
    }),

    deleteDiagramQuiz: builder.mutation<
      ApiResponse<{ success: boolean }>,
      { diagramQuizId: string }
    >({
      query: (data) => ({
        functionName: 'deleteDiagramQuiz',
        data,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'DiagramQuiz', id: arg.diagramQuizId },
        'UserDiagramQuizzes',
        { type: 'Directory', id: 'CONTENTS' },
      ],
    }),
  }),
});

export const {
  useGenerateDiagramQuizMutation,
  useGetDiagramQuizQuery,
  useGetUserDiagramQuizzesQuery,
  useDeleteDiagramQuizMutation,
} = diagramQuizApi;
