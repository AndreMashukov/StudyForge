import { baseApi } from '../baseApi';
import { createArtifactOnQueryStarted } from '../utils/createArtifactOnQueryStarted';
import { auth } from '../../../config/firebase';
import {
  fetchSubjectWorldFromFirestore,
  fetchSubjectWorldProgressFromFirestore,
  fetchUserSubjectWorldsFromFirestore,
} from '../../../services/subjectWorldFirestore';
import { toFirestoreDoc } from '../../../services/firestoreReadUtils';
import { attachArtifactDocListener } from '../utils/artifactDetailRealtime';
import {
  ApiResponse,
  GenerateSubjectWorldRequest,
  GenerateSubjectWorldResponse,
  GetSubjectWorldResponse,
  SaveSubjectWorldProgressRequest,
  SaveSubjectWorldProgressResponse,
  SubjectWorld,
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
      onQueryStarted: createArtifactOnQueryStarted('subjectWorlds', 'Subject world', 'subject world', {
        successMessage: 'Subject world is preparing',
      }),
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
      async queryFn({ subjectWorldId }, _api, _extraOptions, baseQuery) {
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
          const subjectWorld = await fetchSubjectWorldFromFirestore(userId, subjectWorldId);
          if (!subjectWorld) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                data: { message: 'Subject world not found', code: 'NOT_FOUND' },
              },
            };
          }

          return {
            data: {
              success: true,
              data: { subjectWorld },
            },
          };
        } catch (firestoreError) {
          console.warn('Firestore subject world read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getSubjectWorld',
            data: { subjectWorldId },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as ApiResponse<GetSubjectWorldResponse> };
        }
      },
      async onCacheEntryAdded({ subjectWorldId }, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        await attachArtifactDocListener({
          collectionName: 'subjectWorlds',
          docId: subjectWorldId,
          cacheDataLoaded,
          cacheEntryRemoved,
          onMapped: (subjectWorld: SubjectWorld) => {
            updateCachedData((draft) => {
              if (!draft?.data?.subjectWorld) {
                return;
              }
              draft.data.subjectWorld = subjectWorld;
            });
          },
          mapSnapshot: (id, raw) => toFirestoreDoc<SubjectWorld>(id, raw),
        });
      },
      providesTags: (result, error, arg) => [
        { type: 'SubjectWorld', id: arg.subjectWorldId },
      ],
      keepUnusedDataFor: 300,
    }),

    getUserSubjectWorlds: builder.query<ApiResponse<{ subjectWorlds: SubjectWorld[] }>, void>({
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
          const subjectWorlds = await fetchUserSubjectWorldsFromFirestore(userId);
          return { data: { success: true, data: { subjectWorlds } } };
        } catch (firestoreError) {
          console.warn('Firestore subject world list read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getUserSubjectWorlds',
            data: {},
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return { data: fallback.data as ApiResponse<{ subjectWorlds: SubjectWorld[] }> };
        }
      },
      providesTags: ['UserSubjectWorlds'],
      keepUnusedDataFor: 300,
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
        { type: 'SubjectWorld', id: `${arg.subjectWorldId}-progress` },
      ],
    }),

    getSubjectWorldProgress: builder.query<
      ApiResponse<{ progress: SubjectWorldProgressSnapshot | null }>,
      { subjectWorldId: string }
    >({
      async queryFn({ subjectWorldId }, _api, _extraOptions, baseQuery) {
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
          const progress = await fetchSubjectWorldProgressFromFirestore(userId, subjectWorldId);
          return { data: { success: true, data: { progress } } };
        } catch (firestoreError) {
          console.warn('Firestore subject world progress read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getSubjectWorldProgress',
            data: { subjectWorldId },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          return {
            data: fallback.data as ApiResponse<{ progress: SubjectWorldProgressSnapshot | null }>,
          };
        }
      },
      providesTags: (result, error, arg) => [
        { type: 'SubjectWorld', id: `${arg.subjectWorldId}-progress` },
      ],
      keepUnusedDataFor: 300,
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
