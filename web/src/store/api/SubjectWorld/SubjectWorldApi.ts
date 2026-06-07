import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import {
  ApiResponse,
  GenerateSubjectWorldRequest,
  GenerateSubjectWorldResponse,
  GetSubjectWorldResponse,
  SaveSubjectWorldProgressRequest,
  SaveSubjectWorldProgressResponse,
  SubjectWorldProgressSnapshot,
} from '@shared-types';

export const subjectWorldApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateSubjectWorld: builder.mutation<
      ApiResponse<GenerateSubjectWorldResponse>,
      GenerateSubjectWorldRequest
    >({
      query: (data) => ({
        functionName: 'generateSubjectWorld',
        data,
        timeout: 300000,
      }),
      onQueryStarted: createArtifactOnQueryStarted('subjectWorlds', 'Subject world', 'subject world'),
      invalidatesTags: (result, error, arg) => [
        'UserSubjectWorlds',
        { type: 'Directory', id: 'CONTENTS' },
        ...(arg.directoryId
          ? ([{ type: 'Directory' as const, id: arg.directoryId }] as const)
          : []),
      ],
    }),

    getSubjectWorld: builder.query<
      ApiResponse<GetSubjectWorldResponse>,
      { subjectWorldId: string }
    >({
      query: (data) => ({
        functionName: 'getSubjectWorld',
        data,
      }),
      providesTags: (result, error, arg) => [
        { type: 'SubjectWorld', id: arg.subjectWorldId },
      ],
    }),

    getUserSubjectWorlds: builder.query<ApiResponse<{ subjectWorlds: unknown[] }>, void>({
      query: () => ({
        functionName: 'getUserSubjectWorlds',
        data: {},
      }),
      providesTags: ['UserSubjectWorlds'],
    }),

    deleteSubjectWorld: builder.mutation<
      ApiResponse<{ success: boolean }>,
      { subjectWorldId: string }
    >({
      query: (data) => ({
        functionName: 'deleteSubjectWorld',
        data,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'SubjectWorld', id: arg.subjectWorldId },
        'UserSubjectWorlds',
        { type: 'Directory', id: 'CONTENTS' },
      ],
    }),

    saveSubjectWorldProgress: builder.mutation<
      ApiResponse<SaveSubjectWorldProgressResponse>,
      SaveSubjectWorldProgressRequest
    >({
      query: (data) => ({
        functionName: 'saveSubjectWorldProgress',
        data,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'SubjectWorld', id: arg.subjectWorldId },
      ],
    }),

    getSubjectWorldProgress: builder.query<
      ApiResponse<{ progress: SubjectWorldProgressSnapshot | null }>,
      { subjectWorldId: string }
    >({
      query: (data) => ({
        functionName: 'getSubjectWorldProgress',
        data,
      }),
      providesTags: (result, error, arg) => [
        { type: 'SubjectWorld', id: `${arg.subjectWorldId}-progress` },
      ],
    }),
  }),
});

export const {
  useGenerateSubjectWorldMutation,
  useGetSubjectWorldQuery,
  useGetUserSubjectWorldsQuery,
  useDeleteSubjectWorldMutation,
  useSaveSubjectWorldProgressMutation,
  useGetSubjectWorldProgressQuery,
} = subjectWorldApi;
