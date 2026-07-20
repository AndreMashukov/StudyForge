import { baseApi } from '../baseApi';
import {
  IBulkDeleteArtifactsRequest,
  IBulkOperationResponse,
} from '@shared-types';

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
              'UserSubjectWorlds',
            ]
          : [],
    }),
  }),
});

export const { useBulkDeleteArtifactsMutation } = artifactsApi;
