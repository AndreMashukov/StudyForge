import { baseApi } from '../baseApi';
import {
  IBulkDeleteArtifactsRequest,
  IBulkOperationResponse,
} from '@shared-types';
import { auth } from '../../../config/firebase';
import { deleteArtifactByTypeInFirestore } from '../../../services/artifactMutations';
import { executeBulkOperation } from '../../../services/bulkOperation';
import { authRequiredError, customError } from '../../../services/firestoreReadUtils';
import { removeArtifactSummaryFromDirectoryCaches } from '../utils/artifactGenerationOptimistic';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const artifactsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    bulkDeleteArtifacts: builder.mutation<
      IBulkOperationResponse,
      IBulkDeleteArtifactsRequest
    >({
      async queryFn({ artifacts }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const result = await executeBulkOperation({
            items: artifacts,
            getItemId: (item) => item.id,
            runItem: (item) =>
              deleteArtifactByTypeInFirestore(userId, item.type, item.id),
          });
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
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
