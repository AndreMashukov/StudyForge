import type { ApiResponse, GenerationKind, IUserUsageSummary } from '@shared-types';
import { auth } from '../../../config/firebase';
import { fetchUsageSummaryFromFirestore } from '../../../services/usageFirestore';
import {
  authRequiredError,
  notFoundError,
} from '../../../services/firestoreReadUtils';
import { baseApi } from '../baseApi';

function firestoreReadError(message: string) {
  return {
    error: {
      status: 'CUSTOM_ERROR' as const,
      data: { message },
    },
  };
}

function getFirestoreErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export const usageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsageSummary: builder.query<IUserUsageSummary, void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          return authRequiredError();
        }

        try {
          const synced = await baseQuery({
            functionName: 'getUsageSummary',
          });

          if (!('error' in synced)) {
            const syncedResponse = synced.data as ApiResponse<IUserUsageSummary>;
            if (syncedResponse.success && syncedResponse.data) {
              return { data: syncedResponse.data };
            }
          }

          const summary = await fetchUsageSummaryFromFirestore(userId);
          if (!summary) {
            return notFoundError('Usage summary not available');
          }

          return { data: summary };
        } catch (error) {
          return firestoreReadError(
            getFirestoreErrorMessage(error, 'Failed to load usage summary from Firestore'),
          );
        }
      },
    }),
  }),
});

export const { useGetUsageSummaryQuery } = usageApi;

export function selectFeatureAvailability(
  summary: IUserUsageSummary | undefined,
  kind: GenerationKind
) {
  return summary?.featureAvailability.find((entry) => entry.kind === kind);
}
