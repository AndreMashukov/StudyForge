import { baseApi } from '../baseApi';
import {
  Directory,
  DirectoryTreeNode,
  CreateDirectoryRequest,
  UpdateDirectoryRequest,
  MoveDirectoryRequest,
  MoveDocumentRequest,
  CreateDirectoryResponse,
  GetDirectoryResponse,
  GetDirectoryTreeResponse,
  GetDirectoryContentsResponse,
  GetDirectoryAncestorsResponse,
  MoveDirectoryResponse,
  DeleteDirectoryResponse,
} from '../../../../../libs/shared-types/src/index';

export const directoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Create a new directory
    createDirectory: builder.mutation<CreateDirectoryResponse, CreateDirectoryRequest>({
      query: (data) => ({
        url: '/directories',
        method: 'POST',
        data,
      }),
      invalidatesTags: [{ type: 'Directory', id: 'TREE' }, { type: 'Directory', id: 'LIST' }],
    }),

    // Get a single directory
    getDirectory: builder.query<Directory, string>({
      query: (directoryId) => ({
        url: `/directories/${directoryId}`,
        method: 'GET',
      }),
      transformResponse: (response: GetDirectoryResponse) => response.directory,
      providesTags: (result, error, id) => [{ type: 'Directory', id }],
    }),

    // Update a directory
    updateDirectory: builder.mutation<Directory, { id: string; data: UpdateDirectoryRequest }>({
      query: ({ id, data }) => ({
        url: `/directories/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: GetDirectoryResponse) => response.directory,
      invalidatesTags: (result, error, { id }) => [
        { type: 'Directory', id },
        { type: 'Directory', id: 'TREE' },
        { type: 'Directory', id: 'LIST' },
      ],
    }),

    // Delete a directory
    deleteDirectory: builder.mutation<DeleteDirectoryResponse, string>({
      query: (directoryId) => ({
        url: `/directories/${directoryId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        { type: 'Directory', id: 'TREE' },
        { type: 'Directory', id: 'LIST' },
        'Documents',
      ],
    }),

    // Get directory tree
    getDirectoryTree: builder.query<GetDirectoryTreeResponse, void>({
      query: () => ({
        url: '/directories/tree',
        method: 'GET',
      }),
      providesTags: [{ type: 'Directory', id: 'TREE' }],
      keepUnusedDataFor: 300, // 5 minutes
    }),

    // Get directory contents
    getDirectoryContents: builder.query<GetDirectoryContentsResponse, string | null>({
      query: (directoryId) => ({
        url: directoryId 
          ? `/directories/${directoryId}/contents`
          : '/directories/root/contents',
        method: 'GET',
      }),
      providesTags: (result, error, directoryId) => [
        { type: 'Directory', id: directoryId || 'ROOT' },
        { type: 'Directory', id: 'CONTENTS' },
      ],
    }),

    // Get directory ancestors (breadcrumb)
    getDirectoryAncestors: builder.query<GetDirectoryAncestorsResponse, string>({
      query: (directoryId) => ({
        url: `/directories/${directoryId}/ancestors`,
        method: 'GET',
      }),
      providesTags: (result, error, directoryId) => [
        { type: 'Directory', id: `ANCESTORS_${directoryId}` },
      ],
    }),

    // Move a directory
    moveDirectory: builder.mutation<MoveDirectoryResponse, { id: string; data: MoveDirectoryRequest }>({
      query: ({ id, data }) => ({
        url: `/directories/${id}/move`,
        method: 'POST',
        data,
      }),
      invalidatesTags: [
        { type: 'Directory', id: 'TREE' },
        { type: 'Directory', id: 'LIST' },
        { type: 'Directory', id: 'CONTENTS' },
      ],
    }),

    // Get directory by path
    getDirectoryByPath: builder.query<Directory, string>({
      query: (path) => ({
        url: `/directories/by-path`,
        method: 'GET',
        params: { path },
      }),
      transformResponse: (response: GetDirectoryResponse) => response.directory,
      providesTags: (result) => 
        result ? [{ type: 'Directory', id: result.id }] : [],
    }),

    // Move a document to a directory
    moveDocument: builder.mutation<void, { documentId: string; targetDirectoryId: string | null }>({
      query: ({ documentId, targetDirectoryId }) => ({
        url: `/documents/${documentId}/move`,
        method: 'POST',
        data: { targetDirectoryId } as MoveDocumentRequest,
      }),
      invalidatesTags: [
        'Documents',
        { type: 'Directory', id: 'CONTENTS' },
        { type: 'Directory', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useCreateDirectoryMutation,
  useGetDirectoryQuery,
  useUpdateDirectoryMutation,
  useDeleteDirectoryMutation,
  useGetDirectoryTreeQuery,
  useGetDirectoryContentsQuery,
  useGetDirectoryAncestorsQuery,
  useMoveDirectoryMutation,
  useGetDirectoryByPathQuery,
  useMoveDocumentMutation,
} = directoryApi;
