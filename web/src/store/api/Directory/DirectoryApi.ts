import { baseApi } from '../baseApi';
import {
  Directory,
  CreateDirectoryRequest,
  UpdateDirectoryRequest,
  MoveDirectoryRequest,
  MoveDocumentRequest,
  CreateDirectoryResponse,
  GetDirectoryResponse,
  GetDirectoryTreeResponse,
  GetDirectoryContentsResponse,
  GetDirectoryContentsWithArtifactsResponse,
  GetDirectoryContentsWithArtifactSummariesResponse,
  GetDirectoryAncestorsResponse,
  MoveDirectoryResponse,
  DeleteDirectoryResponse,
  IBulkDeleteDirectoriesRequest,
  IBulkOperationResponse,
} from '@shared-types';
import { auth } from '../../../config/firebase';
import {
  fetchDirectoryTreeFromFirestore,
  subscribeToDirectoryTreeIndex,
} from '../../../services/directoryTreeIndex';
import {
  deriveAncestorsFromTree,
  fetchDirectoryFromFirestore,
} from '../../../services/directoryFirestore';
import {
  fetchDirectoryItemsFromFirestore,
  subscribeToDirectoryItems,
} from '../../../services/directoryItemIndex';
import { mapDirectoryItemsToContentsResponse } from '../../../services/directoryItemIndexMappers';
import type { RootState } from '../../index';

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
        { type: 'Directory', id: arg.parentId || 'ROOT' }, // Invalidate parent directory's contents
      ],
    }),

    // Get a single directory
    getDirectory: builder.query<Directory, string>({
      async queryFn(directoryId, _api, _extraOptions, baseQuery) {
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
          const directory = await fetchDirectoryFromFirestore(userId, directoryId);
          if (!directory) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                data: { message: 'Directory not found', code: 'NOT_FOUND' },
              },
            };
          }

          return { data: directory };
        } catch (firestoreError) {
          console.warn('Firestore directory read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getDirectory',
            data: { directoryId },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          const response = fallback.data as GetDirectoryResponse;
          return { data: response.directory };
        }
      },
      providesTags: (result, error, id) => [{ type: 'Directory', id }],
      keepUnusedDataFor: 300,
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
        'Documents',
      ],
    }),

    bulkDeleteDirectories: builder.mutation<IBulkOperationResponse, IBulkDeleteDirectoriesRequest>({
      query: (data) => ({
        functionName: 'bulkDeleteDirectories',
        data,
      }),
      invalidatesTags: [
        { type: 'Directory', id: 'TREE' },
        { type: 'Directory', id: 'LIST' },
        'Documents',
        'Document',
      ],
    }),

    // Directory tree — Firestore-native read with IndexedDB cache; callable fallback on failure.
    getDirectoryTree: builder.query<GetDirectoryTreeResponse, void>({
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
          const data = await fetchDirectoryTreeFromFirestore(userId);
          return { data };
        } catch (firestoreError) {
          console.warn('Firestore directory tree read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({ functionName: 'getDirectoryTree' });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as GetDirectoryTreeResponse };
        }
      },
      async onCacheEntryAdded(_arg, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        try {
          await cacheDataLoaded;
        } catch {
          return;
        }

        const userId = auth.currentUser?.uid;
        if (!userId) {
          await cacheEntryRemoved;
          return;
        }

        const unsubscribe = subscribeToDirectoryTreeIndex(userId, (tree: GetDirectoryTreeResponse) => {
          updateCachedData(() => tree);
        });

        try {
          await cacheEntryRemoved;
        } finally {
          unsubscribe();
        }
      },
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
      ],
      // Retention for fast folder switching; mutations and Firestore invalidation keep data fresh.
      keepUnusedDataFor: 300,
    }),

    getDirectoryContentsWithArtifacts: builder.query<
      GetDirectoryContentsWithArtifactsResponse,
      { directoryId: string | null; artifactLimit?: number }
    >({
      query: ({ directoryId, artifactLimit }) => ({
        functionName: 'getDirectoryContentsWithArtifacts',
        data: {
          directoryId,
          includeArtifacts: true,
          includeRules: true,
          artifactLimit: artifactLimit ?? 20,
        },
      }),
      providesTags: (result, error, arg) => [
        { type: 'Directory', id: arg.directoryId || 'ROOT' },
        'Documents',
        'UserQuizzes',
        'UserFlashcardSets',
        'UserSlideDecks',
        'UserDiagramQuizzes',
        'UserSequenceQuizzes',
      ],
      keepUnusedDataFor: 0,
    }),

    getDirectoryContentsWithArtifactSummaries: builder.query<
      GetDirectoryContentsWithArtifactSummariesResponse,
      { directoryId: string | null; artifactLimit?: number; artifactCursor?: string }
    >({
      async queryFn({ directoryId, artifactLimit, artifactCursor }, _api, _extraOptions, baseQuery) {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Authentication required' },
            },
          };
        }

        if (!directoryId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Directory ID is required' },
            },
          };
        }

        const limit = artifactLimit ?? 20;

        try {
          const [directory, items] = await Promise.all([
            fetchDirectoryFromFirestore(userId, directoryId),
            fetchDirectoryItemsFromFirestore(userId, directoryId),
          ]);

          if (!directory) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                data: { message: 'Directory not found', code: 'NOT_FOUND' },
              },
            };
          }

          return {
            data: mapDirectoryItemsToContentsResponse(directory, items, limit),
          };
        } catch (firestoreError) {
          console.warn(
            'Firestore directory index read failed, falling back to callable:',
            firestoreError,
          );
          const fallback = await baseQuery({
            functionName: 'getDirectoryContentsWithArtifactSummaries',
            data: {
              directoryId,
              includeRules: true,
              artifactLimit: limit,
              ...(artifactCursor ? { artifactCursor } : {}),
            },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as GetDirectoryContentsWithArtifactSummariesResponse };
        }
      },
      async onCacheEntryAdded(
        { directoryId, artifactLimit },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        if (!directoryId) {
          await cacheEntryRemoved;
          return;
        }

        try {
          await cacheDataLoaded;
        } catch {
          return;
        }

        const userId = auth.currentUser?.uid;
        if (!userId) {
          await cacheEntryRemoved;
          return;
        }

        const limit = artifactLimit ?? 20;
        const unsubscribe = subscribeToDirectoryItems(userId, directoryId, (items) => {
          updateCachedData((draft) => {
            const mapped = mapDirectoryItemsToContentsResponse(draft.directory, items, limit);
            draft.subdirectories = mapped.subdirectories;
            draft.documents = mapped.documents;
            draft.artifactSummaries = mapped.artifactSummaries;
            draft.totalCount = mapped.totalCount;
          });
        });

        try {
          await cacheEntryRemoved;
        } finally {
          unsubscribe();
        }
      },
      providesTags: (result, error, arg) => [
        { type: 'Directory', id: arg.directoryId || 'ROOT' },
        'Documents',
        'UserQuizzes',
        'UserFlashcardSets',
        'UserSlideDecks',
        'UserDiagramQuizzes',
        'UserSequenceQuizzes',
      ],
      keepUnusedDataFor: 300,
    }),

    // Get directory ancestors (breadcrumb)
    getDirectoryAncestors: builder.query<GetDirectoryAncestorsResponse, string>({
      async queryFn(directoryId, api, _extraOptions, baseQuery) {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Authentication required' },
            },
          };
        }

        const state = api.getState() as RootState;
        const cachedTree = directoryApi.endpoints.getDirectoryTree.select()(state).data;
        if (cachedTree) {
          const derived = deriveAncestorsFromTree(cachedTree, directoryId);
          if (derived) {
            return { data: derived };
          }
        }

        try {
          const fallback = await baseQuery({
            functionName: 'getDirectoryAncestors',
            data: { directoryId },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as GetDirectoryAncestorsResponse };
        } catch (error) {
          console.warn('Directory ancestors callable fallback failed:', error);
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Failed to fetch directory ancestors' },
            },
          };
        }
      },
      providesTags: (result, error, directoryId) => [
        { type: 'Directory', id: `ANCESTORS_${directoryId}` },
      ],
      keepUnusedDataFor: 300,
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
        'InteractionStats',
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
    moveDocument: builder.mutation<void, { documentId: string; targetDirectoryId: string }>({
      query: ({ documentId, targetDirectoryId }) => ({
        functionName: 'moveDocument',
        data: { documentId, targetDirectoryId } as { documentId: string } & MoveDocumentRequest,
      }),
      invalidatesTags: [
        'Documents',
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
  useBulkDeleteDirectoriesMutation,
  useGetDirectoryTreeQuery,
  useGetDirectoryContentsQuery,
  useGetDirectoryContentsWithArtifactsQuery,
  useGetDirectoryContentsWithArtifactSummariesQuery,
  useGetDirectoryAncestorsQuery,
  useMoveDirectoryMutation,
  useGetDirectoryByPathQuery,
  useMoveDocumentMutation,
} = directoryApi;
