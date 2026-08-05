import type { ApiResponse, GenerationKind, IUserUsageSummary } from '@shared-types';
import { baseApi } from '../baseApi';

export const usageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsageSummary: builder.query<IUserUsageSummary, void>({
      query: () => ({
        functionName: 'getUsageSummary',
      }),
      transformResponse: (response: ApiResponse<IUserUsageSummary>) => {
        if (!response.success || !response.data) {
          throw new Error(response.error?.message ?? 'Failed to load usage summary');
        }
        return response.data;
      },
      providesTags: ['UsageSummary'],
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
