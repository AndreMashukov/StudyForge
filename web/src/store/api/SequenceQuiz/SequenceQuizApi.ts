import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import { auth } from '../../../config/firebase';
import {
  fetchSequenceQuizFromFirestore,
  fetchUserSequenceQuizzesFromFirestore,
} from '../../../services/artifactFirestore';
import { toFirestoreDoc } from '../../../services/firestoreReadUtils';
import { attachArtifactDocListener } from '../utils/artifactDetailRealtime';
import {
  ApiResponse,
  GenerateSequenceQuizRequest,
  GenerateSequenceQuizResponse,
  GetSequenceQuizResponse,
  SequenceQuiz,
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
      onQueryStarted: createArtifactOnQueryStarted('sequenceQuizzes', 'Sequence quiz', 'sequence quiz', {
        successMessage: 'Sequence quiz is preparing',
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
      async queryFn({ sequenceQuizId }, _api, _extraOptions, baseQuery) {
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
          const sequenceQuiz = await fetchSequenceQuizFromFirestore(userId, sequenceQuizId);
          if (!sequenceQuiz) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                data: { message: 'Sequence quiz not found', code: 'NOT_FOUND' },
              },
            };
          }

          return {
            data: {
              success: true,
              data: { sequenceQuiz },
            },
          };
        } catch (firestoreError) {
          console.warn('Firestore sequence quiz read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getSequenceQuiz',
            data: { sequenceQuizId },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as ApiResponse<GetSequenceQuizResponse> };
        }
      },
      async onCacheEntryAdded({ sequenceQuizId }, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        await attachArtifactDocListener({
          collectionName: 'sequenceQuizzes',
          docId: sequenceQuizId,
          cacheDataLoaded,
          cacheEntryRemoved,
          onMapped: (sequenceQuiz: SequenceQuiz) => {
            updateCachedData((draft) => {
              if (!draft?.data?.sequenceQuiz) {
                return;
              }
              draft.data.sequenceQuiz = sequenceQuiz;
            });
          },
          mapSnapshot: (id, raw) => toFirestoreDoc<SequenceQuiz>(id, raw),
        });
      },
      providesTags: (result, error, arg) => [
        { type: 'SequenceQuiz', id: arg.sequenceQuizId },
      ],
      keepUnusedDataFor: 300,
    }),

    getUserSequenceQuizzes: builder.query<ApiResponse<{ sequenceQuizzes: SequenceQuiz[] }>, void>({
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
          const sequenceQuizzes = await fetchUserSequenceQuizzesFromFirestore(userId);
          return { data: { success: true, data: { sequenceQuizzes } } };
        } catch (firestoreError) {
          console.warn('Firestore sequence quiz list read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getUserSequenceQuizzes',
            data: {},
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as ApiResponse<{ sequenceQuizzes: SequenceQuiz[] }> };
        }
      },
      providesTags: ['UserSequenceQuizzes'],
      keepUnusedDataFor: 300,
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
