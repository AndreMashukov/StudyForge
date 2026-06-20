import { baseApi } from '../baseApi';
import { addPendingGeneration, removePendingGeneration } from '../../slices/artifactGenerationSlice';
import { showToast } from '../../slices/uiSlice';
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
        timeout: 60000,
      }),
      onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
        if (!arg.directoryId) return;
        dispatch(addPendingGeneration({ directoryId: arg.directoryId, artifactType: 'diagramQuizzes' }));
        try {
          const { data } = await queryFulfilled;
          dispatch(removePendingGeneration({ directoryId: arg.directoryId, artifactType: 'diagramQuizzes' }));
          if (data?.success !== false) {
            dispatch(showToast({
              message: 'Diagram quiz generation started — it will appear when ready',
              type: 'success',
            }));
          } else {
            dispatch(showToast({
              message: data.error?.message || 'Failed to start diagram quiz generation',
              type: 'error',
            }));
          }
        } catch {
          dispatch(removePendingGeneration({ directoryId: arg.directoryId, artifactType: 'diagramQuizzes' }));
        }
      },
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
