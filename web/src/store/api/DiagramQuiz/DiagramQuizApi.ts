import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import { auth } from '../../../config/firebase';
import {
  fetchDiagramQuizFromFirestore,
  fetchUserDiagramQuizzesFromFirestore,
} from '../../../services/artifactFirestore';
import { toFirestoreDoc } from '../../../services/firestoreReadUtils';
import { attachArtifactDocListener } from '../utils/artifactDetailRealtime';
import {
  ApiResponse,
  DiagramQuiz,
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
      onQueryStarted: createArtifactOnQueryStarted('diagramQuizzes', 'Diagram quiz', 'diagram quiz', {
        successMessage: 'Diagram quiz generation started — it will appear when ready',
      }),
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
      async queryFn({ diagramQuizId }, _api, _extraOptions, baseQuery) {
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
          const diagramQuiz = await fetchDiagramQuizFromFirestore(userId, diagramQuizId);
          if (!diagramQuiz) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                data: { message: 'Diagram quiz not found', code: 'NOT_FOUND' },
              },
            };
          }

          return {
            data: {
              success: true,
              data: { diagramQuiz },
            },
          };
        } catch (firestoreError) {
          console.warn('Firestore diagram quiz read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getDiagramQuiz',
            data: { diagramQuizId },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as ApiResponse<GetDiagramQuizResponse> };
        }
      },
      async onCacheEntryAdded({ diagramQuizId }, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        await attachArtifactDocListener({
          collectionName: 'diagramQuizzes',
          docId: diagramQuizId,
          cacheDataLoaded,
          cacheEntryRemoved,
          onMapped: (diagramQuiz: DiagramQuiz) => {
            updateCachedData((draft) => {
              if (!draft?.data?.diagramQuiz) {
                return;
              }
              draft.data.diagramQuiz = diagramQuiz;
            });
          },
          mapSnapshot: (id, raw) => toFirestoreDoc<DiagramQuiz>(id, raw),
        });
      },
      providesTags: (result, error, arg) => [
        { type: 'DiagramQuiz', id: arg.diagramQuizId },
      ],
      keepUnusedDataFor: 300,
    }),

    getUserDiagramQuizzes: builder.query<ApiResponse<{ diagramQuizzes: DiagramQuiz[] }>, void>({
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
          const diagramQuizzes = await fetchUserDiagramQuizzesFromFirestore(userId);
          return { data: { success: true, data: { diagramQuizzes } } };
        } catch (firestoreError) {
          console.warn('Firestore diagram quiz list read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getUserDiagramQuizzes',
            data: {},
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as ApiResponse<{ diagramQuizzes: DiagramQuiz[] }> };
        }
      },
      providesTags: ['UserDiagramQuizzes'],
      keepUnusedDataFor: 300,
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
