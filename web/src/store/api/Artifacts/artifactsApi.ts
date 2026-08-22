import { baseApi } from '../baseApi';
import {
  IBulkDeleteArtifactsRequest,
  IBulkOperationResponse,
} from '@shared-types';
import { removeArtifactSummaryFromDirectoryCaches } from '../utils/artifactGenerationOptimistic';

export const artifactsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    bulkDeleteArtifacts: builder.mutation<
      IBulkOperationResponse,
      IBulkDeleteArtifactsRequest
    >({
      query: (data) => ({
        functionName: 'bulkDeleteArtifacts',
        data,
      }),
      invalidatesTags: (result) =>
        result && result.succeeded > 0
          ? [
              { type: 'Directory', id: 'LIST' },
              'UserQuizzes',
              'UserFlashcardSets',
              'UserSlideDecks',
              'UserDiagramQuizzes',
              'UserSequenceQuizzes',
            ]
          : [],
      async onQueryStarted({ artifacts }, { dispatch, getState, queryFulfilled }) {
        const patches = artifacts.flatMap((artifact) =>
          removeArtifactSummaryFromDirectoryCaches(
            dispatch,
            getState,
            artifact.id,
            artifact.type,
          ),
        );
        try {
          const { data } = await queryFulfilled;
          if (!data || data.succeeded === 0) {
            patches.forEach((patch) => patch.undo());
          }
        } catch {
          patches.forEach((patch) => patch.undo());
        }
      },
    }),
  }),
});

export const { useBulkDeleteArtifactsMutation } = artifactsApi;
