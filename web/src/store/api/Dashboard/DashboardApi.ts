import type {
  GetInteractionStatsRequest,
  ICompletedDashboardArtifactsResponse,
} from '@shared-types';
import { baseApi } from '../baseApi';
import { auth } from '../../../config/firebase';
import { fetchCompletedDashboardArtifacts } from '../../../services/dashboardArtifacts';
import {
  authRequiredError,
  customError,
} from '../../../services/firestoreReadUtils';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCompletedDashboardArtifacts: builder.query<
      ICompletedDashboardArtifactsResponse,
      Pick<GetInteractionStatsRequest, 'startDate' | 'endDate'>
    >({
      async queryFn(range) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          return {
            data: {
              artifacts: await fetchCompletedDashboardArtifacts(userId, range),
            },
          };
        } catch (error) {
          return customError(
            error instanceof Error
              ? error.message
              : 'Could not load generated artifacts',
          );
        }
      },
      providesTags: [
        'Directory',
        'UserQuizzes',
        'UserFlashcardSets',
        'UserSlideDecks',
        'UserDiagramQuizzes',
        'UserSequenceQuizzes',
        'UserMatchQuizzes',
      ],
    }),
  }),
});

export const { useGetCompletedDashboardArtifactsQuery } = dashboardApi;
