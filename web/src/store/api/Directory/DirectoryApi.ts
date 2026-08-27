import { baseApi } from '../baseApi';
import {
  Directory,
  CreateDirectoryRequest,
  UpdateDirectoryRequest,
  MoveDirectoryRequest,
  CreateDirectoryResponse,
  GetDirectoryTreeResponse,
  GetDirectoryContentsResponse,
  GetDirectoryContentsWithArtifactsResponse,
  GetDirectoryContentsWithArtifactSummariesResponse,
  GetDirectoryAncestorsResponse,
  MoveDirectoryResponse,
  DeleteDirectoryResponse,
  IBulkDeleteDirectoriesRequest,
  IBulkOperationResponse,
  ReorderDirectoryItemsRequest,
  ReorderDirectoryItemsResponse,
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
import {
  createDirectoryInFirestore,
  updateDirectoryInFirestore,
  deleteDirectoryInFirestore,
  moveDirectoryInFirestore,
  getDirectoryByPathFromFirestore,
} from '../../../services/directoryMutations';
import { reorderDirectoryItems } from '../../../services/directoryItemIndexMutations';
import { moveDocumentInFirestore } from '../../../services/documentMutations';
import { executeBulkOperation } from '../../../services/bulkOperation';
import {
  authRequiredError,
  customError,
  notFoundError,
} from '../../../services/firestoreReadUtils';
import { resolveDirectoryRulesClient } from '../../../services/directoryRulesResolution';
import {
  fetchQuizFromFirestore,
} from '../../../services/quizFirestore';
import {
  fetchFlashcardSetFromFirestore,
  fetchSlideDeckFromFirestore,
  fetchDiagramQuizFromFirestore,
  fetchSequenceQuizFromFirestore,
} from '../../../services/artifactFirestore';
import { upsertSubdirectoryInDirectoryCaches } from '../../../hooks/directoryRealtimeCacheUtils';
import { patchReorderInAllDirectoryContentsCaches } from './directoryReorderCacheUtils';
import type { RootState } from '../../index';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { toFirestoreDoc } from '../../../services/firestoreReadUtils';
import type { DocumentEnhanced } from '@shared-types';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

function buildRootDirectory(userId: string, subdirCount: number, docCount: number): Directory {
  return {
    id: 'root',
    userId,
    name: 'Root',
    parentId: null,
    path: '/',
    level: 0,
    documentCount: docCount,
    childCount: subdirCount,
    quizCount: 0,
    flashcardSetCount: 0,
    slideDeckCount: 0,
    diagramQuizCount: 0,
    ruleIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function fetchRootDirectoryContents(userId: string): Promise<GetDirectoryContentsResponse> {
  const subdirSnap = await getDocs(
    query(
      collection(db, 'users', userId, 'directories'),
      where('parentId', '==', null),
      orderBy('name', 'asc'),
    ),
  );
  const docsSnap = await getDocs(
    query(
      collection(db, 'users', userId, 'documents'),
      where('directoryId', '==', null),
      orderBy('createdAt', 'desc'),
      limit(100),
    ),
  );

  const subdirectories = subdirSnap.docs.map((docSnap) =>
    toFirestoreDoc<Directory>(docSnap.id, docSnap.data()),
  );
  const documents = docsSnap.docs.map((docSnap) =>
    toFirestoreDoc<DocumentEnhanced>(docSnap.id, docSnap.data()),
  );

  return {
    directory: buildRootDirectory(userId, subdirectories.length, documents.length),
    subdirectories,
    documents,
    totalCount: subdirectories.length + documents.length,
  };
}

async function fetchDirectoryContentsFromFirestore(
  userId: string,
  directoryId: string | null,
): Promise<GetDirectoryContentsResponse> {
  if (!directoryId) {
    return fetchRootDirectoryContents(userId);
  }

  const [directory, items] = await Promise.all([
    fetchDirectoryFromFirestore(userId, directoryId),
    fetchDirectoryItemsFromFirestore(userId, directoryId),
  ]);

  if (!directory) {
    throw new Error('Directory not found');
  }

  const mapped = mapDirectoryItemsToContentsResponse(directory, items);
  return {
    directory: mapped.directory,
    subdirectories: mapped.subdirectories,
    documents: mapped.documents,
    totalCount: mapped.subdirectories.length + mapped.documents.length,
  };
}

export const directoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createDirectory: builder.mutation<
      CreateDirectoryResponse,
      CreateDirectoryRequest
    >({
      async queryFn(data, _api, _extraOptions) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const directory = await createDirectoryInFirestore(userId, data);
          return {
            data: { directoryId: directory.id, directory },
          };
        } catch (error) {
          return mutationError(error);
        }
      },
      async onQueryStarted(arg, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          upsertSubdirectoryInDirectoryCaches(
            dispatch,
            getState as () => RootState,
            arg.parentId ?? null,
            data.directory,
          );
        } catch {
          // Error toast handled by middleware; cache stays unchanged.
        }
      },
    }),

    getDirectory: builder.query<Directory, string>({
      async queryFn(directoryId) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const directory = await fetchDirectoryFromFirestore(userId, directoryId);
          if (!directory) return notFoundError('Directory not found');
          return { data: directory };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Directory', id }],
      keepUnusedDataFor: 300,
    }),

    updateDirectory: builder.mutation<
      Directory,
      { id: string; data: UpdateDirectoryRequest }
    >({
      async queryFn({ id, data }, _api, _extraOptions) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const directory = await updateDirectoryInFirestore(userId, id, data);
          return { data: directory };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Directory', id },
        { type: 'Directory', id: 'TREE' },
        { type: 'Directory', id: 'LIST' },
      ],
    }),

    deleteDirectory: builder.mutation<DeleteDirectoryResponse, string>({
      async queryFn(directoryId, _api, _extraOptions) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await deleteDirectoryInFirestore(userId, directoryId);
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: [
        { type: 'Directory', id: 'TREE' },
        { type: 'Directory', id: 'LIST' },
        'Documents',
      ],
    }),

    bulkDeleteDirectories: builder.mutation<
      IBulkOperationResponse,
      IBulkDeleteDirectoriesRequest
    >({
      async queryFn({ directoryIds }, _api, _extraOptions) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await executeBulkOperation({
            items: directoryIds,
            getItemId: (id) => id,
            runItem: (directoryId) =>
              deleteDirectoryInFirestore(userId, directoryId).then(() => undefined),
          });
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: [
        { type: 'Directory', id: 'TREE' },
        { type: 'Directory', id: 'LIST' },
        'Documents',
        'Document',
      ],
    }),

    getDirectoryTree: builder.query<GetDirectoryTreeResponse, void>({
      async queryFn() {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const data = await fetchDirectoryTreeFromFirestore(userId);
          return { data };
        } catch (error) {
          return mutationError(error);
        }
      },
      async onCacheEntryAdded(
        _arg,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
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

        const unsubscribe = subscribeToDirectoryTreeIndex(
          userId,
          (tree: GetDirectoryTreeResponse) => {
            updateCachedData(() => tree);
          },
        );

        try {
          await cacheEntryRemoved;
        } finally {
          unsubscribe();
        }
      },
      providesTags: [{ type: 'Directory', id: 'TREE' }],
      keepUnusedDataFor: 300,
    }),

    getDirectoryContents: builder.query<
      GetDirectoryContentsResponse,
      string | null
    >({
      async queryFn(directoryId) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const data = await fetchDirectoryContentsFromFirestore(userId, directoryId);
          return { data };
        } catch (error) {
          if (error instanceof Error && error.message === 'Directory not found') {
            return notFoundError('Directory not found');
          }
          return mutationError(error);
        }
      },
      providesTags: (_result, _error, directoryId) => [
        { type: 'Directory', id: directoryId || 'ROOT' },
      ],
      keepUnusedDataFor: 300,
    }),

    getDirectoryContentsWithArtifacts: builder.query<
      GetDirectoryContentsWithArtifactsResponse,
      { directoryId: string | null; artifactLimit?: number }
    >({
      async queryFn({ directoryId, artifactLimit }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const base = await fetchDirectoryContentsFromFirestore(userId, directoryId);
          const limitCount = Math.min(artifactLimit ?? 20, 100);

          const quizzes: GetDirectoryContentsWithArtifactsResponse['quizzes'] = [];
          const flashcardSets: GetDirectoryContentsWithArtifactsResponse['flashcardSets'] = [];
          const slideDecks: GetDirectoryContentsWithArtifactsResponse['slideDecks'] = [];
          const diagramQuizzes: GetDirectoryContentsWithArtifactsResponse['diagramQuizzes'] = [];
          const sequenceQuizzes: GetDirectoryContentsWithArtifactsResponse['sequenceQuizzes'] = [];
          let resolvedRules: GetDirectoryContentsWithArtifactsResponse['resolvedRules'] = {
            rules: [],
            inheritanceMap: {},
          };

          if (directoryId) {
            const items = await fetchDirectoryItemsFromFirestore(userId, directoryId);
            const selectedByType: Record<
              'quiz' | 'flashcard' | 'slideDeck' | 'diagramQuiz' | 'sequenceQuiz',
              typeof items
            > = {
              quiz: [],
              flashcard: [],
              slideDeck: [],
              diagramQuiz: [],
              sequenceQuiz: [],
            };

            for (const item of items) {
              if (
                item.itemType !== 'quiz'
                && item.itemType !== 'flashcard'
                && item.itemType !== 'slideDeck'
                && item.itemType !== 'diagramQuiz'
                && item.itemType !== 'sequenceQuiz'
              ) {
                continue;
              }
              const bucket = selectedByType[item.itemType];
              if (bucket.length < limitCount) {
                bucket.push(item);
              }
            }

            const artifactItems = [
              ...selectedByType.quiz,
              ...selectedByType.flashcard,
              ...selectedByType.slideDeck,
              ...selectedByType.diagramQuiz,
              ...selectedByType.sequenceQuiz,
            ];

            const fetchArtifact = async (item: (typeof artifactItems)[number]) => {
              switch (item.itemType) {
                case 'quiz': {
                  const quiz = await fetchQuizFromFirestore(userId, item.sourceId);
                  return quiz ? { type: 'quiz' as const, value: quiz } : null;
                }
                case 'flashcard': {
                  const set = await fetchFlashcardSetFromFirestore(userId, item.sourceId);
                  return set ? { type: 'flashcard' as const, value: set } : null;
                }
                case 'slideDeck': {
                  const deck = await fetchSlideDeckFromFirestore(userId, item.sourceId);
                  return deck ? { type: 'slideDeck' as const, value: deck } : null;
                }
                case 'diagramQuiz': {
                  const dq = await fetchDiagramQuizFromFirestore(userId, item.sourceId);
                  return dq ? { type: 'diagramQuiz' as const, value: dq } : null;
                }
                case 'sequenceQuiz': {
                  const sq = await fetchSequenceQuizFromFirestore(userId, item.sourceId);
                  return sq ? { type: 'sequenceQuiz' as const, value: sq } : null;
                }
                default:
                  return null;
              }
            };

            const fetched = await Promise.all(artifactItems.map(fetchArtifact));

            for (const entry of fetched) {
              if (!entry) continue;
              switch (entry.type) {
                case 'quiz':
                  if (quizzes.length < limitCount) quizzes.push(entry.value);
                  break;
                case 'flashcard':
                  if (flashcardSets.length < limitCount) flashcardSets.push(entry.value);
                  break;
                case 'slideDeck':
                  if (slideDecks.length < limitCount) slideDecks.push(entry.value);
                  break;
                case 'diagramQuiz':
                  if (diagramQuizzes.length < limitCount) diagramQuizzes.push(entry.value);
                  break;
                case 'sequenceQuiz':
                  if (sequenceQuizzes.length < limitCount) sequenceQuizzes.push(entry.value);
                  break;
                default:
                  break;
              }
            }

            resolvedRules = await resolveDirectoryRulesClient(userId, directoryId, {
              includeAncestors: true,
            });
          }

          return {
            data: {
              ...base,
              quizzes,
              flashcardSets,
              slideDecks,
              diagramQuizzes,
              sequenceQuizzes,
              resolvedRules,
            },
          };
        } catch (error) {
          if (error instanceof Error && error.message === 'Directory not found') {
            return notFoundError('Directory not found');
          }
          return mutationError(error);
        }
      },
      providesTags: (_result, _error, arg) => [
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
      {
        directoryId: string | null;
        artifactLimit?: number;
        artifactCursor?: string;
      }
    >({
      async queryFn({ directoryId, artifactLimit }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        if (!directoryId) {
          return customError('Directory ID is required');
        }

        const limit = artifactLimit ?? 20;

        try {
          const [directory, items] = await Promise.all([
            fetchDirectoryFromFirestore(userId, directoryId),
            fetchDirectoryItemsFromFirestore(userId, directoryId),
          ]);

          if (!directory) return notFoundError('Directory not found');

          return {
            data: mapDirectoryItemsToContentsResponse(directory, items, limit),
          };
        } catch (error) {
          return mutationError(error);
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
        const unsubscribe = subscribeToDirectoryItems(
          userId,
          directoryId,
          (items) => {
            updateCachedData((draft) => {
              const mapped = mapDirectoryItemsToContentsResponse(
                draft.directory,
                items,
                limit,
              );
              draft.subdirectories = mapped.subdirectories;
              draft.documents = mapped.documents;
              draft.artifactSummaries = mapped.artifactSummaries;
              draft.totalCount = mapped.totalCount;
            });
          },
        );

        try {
          await cacheEntryRemoved;
        } finally {
          unsubscribe();
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: 'Directory', id: arg.directoryId || 'ROOT' },
      ],
      keepUnusedDataFor: 300,
    }),

    getDirectoryAncestors: builder.query<GetDirectoryAncestorsResponse, string>({
      async queryFn(directoryId, api) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        const state = api.getState() as RootState;
        const cachedTree =
          directoryApi.endpoints.getDirectoryTree.select()(state).data;
        if (cachedTree) {
          const derived = deriveAncestorsFromTree(cachedTree, directoryId);
          if (derived) {
            return { data: derived };
          }
        }

        try {
          const tree = await fetchDirectoryTreeFromFirestore(userId);
          const derived = deriveAncestorsFromTree(tree, directoryId);
          if (!derived) return notFoundError('Directory not found');
          return { data: derived };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: (_result, _error, directoryId) => [
        { type: 'Directory', id: `ANCESTORS_${directoryId}` },
      ],
      keepUnusedDataFor: 300,
    }),

    moveDirectory: builder.mutation<
      MoveDirectoryResponse,
      { id: string; data: MoveDirectoryRequest }
    >({
      async queryFn({ id, data }, _api, _extraOptions) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await moveDirectoryInFirestore(userId, id, data);
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: [
        { type: 'Directory', id: 'TREE' },
        { type: 'Directory', id: 'LIST' },
        'InteractionStats',
      ],
    }),

    getDirectoryByPath: builder.query<Directory, string>({
      async queryFn(path) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const directory = await getDirectoryByPathFromFirestore(userId, path);
          if (!directory) return notFoundError('Directory not found');
          return { data: directory };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: (result) =>
        result ? [{ type: 'Directory', id: result.id }] : [],
    }),

    moveDocument: builder.mutation<
      void,
      { documentId: string; targetDirectoryId: string }
    >({
      async queryFn({ documentId, targetDirectoryId }, _api, _extraOptions) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          await moveDocumentInFirestore(userId, documentId, {
            targetDirectoryId,
          });
          return { data: undefined };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: ['Documents', { type: 'Directory', id: 'LIST' }],
    }),

    reorderDirectoryItems: builder.mutation<
      ReorderDirectoryItemsResponse,
      ReorderDirectoryItemsRequest
    >({
      async queryFn(data, _api, _extraOptions) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await reorderDirectoryItems(userId, data);
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
      async onQueryStarted(
        { directoryId, itemType, orderedSourceIds },
        { dispatch, queryFulfilled, getState },
      ) {
        const patchResults = patchReorderInAllDirectoryContentsCaches(
          dispatch,
          getState as () => RootState,
          directoryId,
          itemType,
          orderedSourceIds,
        );

        try {
          await queryFulfilled;
        } catch {
          patchResults.forEach((patch) => patch.undo());
        }
      },
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
  useReorderDirectoryItemsMutation,
} = directoryApi;
