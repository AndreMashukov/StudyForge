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
} from '@shared-types';

export const directoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Create a new directory
    createDirectory: builder.mutation<CreateDirectoryResponse, CreateDirectoryRequest>({
      query: (data) => ({
        functionName: 'createDirectory',
        data,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Directory', id: 'TREE' },
        { type: 'Directory', id: 'LIST' },
        { type: 'Directory', id: 'CONTENTS' },
        { type: 'Directory', id: arg.parentId || 'ROOT' }, // Invalidate parent directory's contents
      ],
    }),

    // Get a single directory
    getDirectory: builder.query<Directory, string>({
      query: (directoryId) => ({
        functionName: 'getDirectory',
        data: { directoryId },
      }),
      transformResponse: (response: GetDirectoryResponse) => response.directory,
      providesTags: (result, error, id) => [{ type: 'Directory', id }],
    }),

    // Update a directory
    updateDirectory: builder.mutation<Directory, { id: string; data: UpdateDirectoryRequest }>({
      query: ({ id, data }) => ({
        functionName: 'updateDirectory',
        data: { directoryId: id, ...data },
      }),
      transformResponse: (response: GetDirectoryResponse) => response.directory,
      invalidatesTags: (result, error, { id }) => [
        { type: 'Directory', id },
        { type: 'Directory', id: 'TREE' },
        { type: 'Directory', id: 'LIST' },
        { type: 'Directory', id: 'CONTENTS' },
      ],
    }),

    // Delete a directory
    deleteDirectory: builder.mutation<DeleteDirectoryResponse, string>({
      query: (directoryId) => ({
        functionName: 'deleteDirectory',
        data: { directoryId },
      }),
      invalidatesTags: [
        { type: 'Directory', id: 'TREE' },
        { type: 'Directory', id: 'LIST' },
        { type: 'Directory', id: 'CONTENTS' },
        'Documents',
      ],
    }),

    // Get directory tree
    getDirectoryTree: builder.query<GetDirectoryTreeResponse, void>({
      query: () => ({
        functionName: 'getDirectoryTree',
      }),
      providesTags: [{ type: 'Directory', id: 'TREE' }],
      keepUnusedDataFor: 300, // 5 minutes
    }),

    // Get directory contents
    getDirectoryContents: builder.query<GetDirectoryContentsResponse, string | null>({
      query: (directoryId) => ({
        functionName: 'getDirectoryContents',
        data: { directoryId },
      }),
      providesTags: (result, error, directoryId) => [
        { type: 'Directory', id: directoryId || 'ROOT' },
        { type: 'Directory', id: 'CONTENTS' },
      ],
      // Always refetch when the directory ID changes (don't rely on stale cache)
      keepUnusedDataFor: 0, // Don't cache directory contents for long
    }),

    // Get directory ancestors (breadcrumb)
    getDirectoryAncestors: builder.query<GetDirectoryAncestorsResponse, string>({
      query: (directoryId) => ({
        functionName: 'getDirectoryAncestors',
        data: { directoryId },
      }),
      providesTags: (result, error, directoryId) => [
        { type: 'Directory', id: `ANCESTORS_${directoryId}` },
      ],
    }),

    // Move a directory
    moveDirectory: builder.mutation<MoveDirectoryResponse, { id: string; data: MoveDirectoryRequest }>({
      query: ({ id, data }) => ({
        functionName: 'moveDirectory',
        data: { directoryId: id, ...data },
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
        functionName: 'getDirectoryByPath',
        data: { path },
      }),
      transformResponse: (response: GetDirectoryResponse) => response.directory,
      providesTags: (result) => 
        result ? [{ type: 'Directory', id: result.id }] : [],
    }),

    // Move a document to a directory
    moveDocument: builder.mutation<void, { documentId: string; targetDirectoryId: string | null }>({
      query: ({ documentId, targetDirectoryId }) => ({
        functionName: 'moveDocument',
        data: { documentId, targetDirectoryId } as MoveDocumentRequest,
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
